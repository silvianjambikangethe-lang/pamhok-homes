import "server-only";
import crypto from "crypto";
import { buildZip } from "@/lib/zip";
import type { SmileIdResult } from "@/lib/supabase/types";

export function isSmileIdConfigured() {
  return Boolean(
    process.env.SMILE_ID_PARTNER_ID && process.env.SMILE_ID_API_KEY,
  );
}

function smileIdBaseUrl() {
  return process.env.SMILE_ID_ENV === "production"
    ? "https://api.smileidentity.com/v1"
    : "https://testapi.smileidentity.com/v1";
}

// HMAC-SHA256(apiKey, timestamp + partnerId + "sid_request"), base64-encoded —
// Smile ID's documented signing scheme, confirmed against their sandbox.
function generateSignature(partnerId: string, apiKey: string, timestamp: string): string {
  const hmac = crypto.createHmac("sha256", apiKey);
  hmac.update(timestamp, "utf8");
  hmac.update(partnerId, "utf8");
  hmac.update("sid_request", "utf8");
  return hmac.digest("base64");
}

interface UploadPrepResponse {
  smile_job_id: string;
  upload_url: string;
  ref_id: string;
  camera_config: string | null;
  code: string;
}

interface JobStatusResponse {
  job_complete: boolean;
  job_success: boolean;
  result?: {
    ResultCode: string;
    ResultText: string;
    Actions?: Record<string, string>;
  };
}

// Runs a Document Verification job (job_type 6): ID card + selfie image are
// required by Smile ID's own backend — a job submitted with only an ID
// image is rejected with "info.json does not contain ... a selfie image".
export async function runDocumentVerification({
  jobId,
  userId,
  idImage,
  selfieImage,
  country,
  idType,
}: {
  jobId: string;
  userId: string;
  idImage: { buffer: Buffer; fileName: string };
  selfieImage: { buffer: Buffer; fileName: string };
  country: string;
  idType: string;
}): Promise<SmileIdResult> {
  const partnerId = process.env.SMILE_ID_PARTNER_ID!;
  const apiKey = process.env.SMILE_ID_API_KEY!;
  const base = smileIdBaseUrl();

  const partnerParams = { user_id: userId, job_id: jobId, job_type: 6 };
  const timestamp = new Date().toISOString();
  const signature = generateSignature(partnerId, apiKey, timestamp);

  const uploadRes = await fetch(`${base}/upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      callback_url: "",
      file_name: "selfie.zip",
      model_parameters: {},
      partner_params: partnerParams,
      smile_client_id: partnerId,
      use_enrolled_image: false,
      country,
      id_type: idType,
      entered: "false",
      signature,
      timestamp,
      source_sdk: "rest_api",
      source_sdk_version: "1.0.0",
    }),
  });

  if (!uploadRes.ok) {
    throw new Error(`Smile ID upload prep failed (${uploadRes.status}).`);
  }
  const uploadData = (await uploadRes.json()) as UploadPrepResponse;

  const infoJson = {
    package_information: {
      apiVersion: { buildNumber: 0, majorVersion: 2, minorVersion: 0 },
      language: "javascript",
    },
    misc_information: {
      signature,
      retry: "false",
      partner_params: partnerParams,
      timestamp,
      file_name: "selfie.zip",
      smile_client_id: partnerId,
      callback_url: "",
      userData: {
        isVerifiedProcess: false,
        name: "",
        fbUserID: "",
        firstName: "",
        lastName: "",
        gender: "",
        email: "",
        phone: "",
        countryCode: "+",
        countryName: "",
      },
    },
    id_info: { country, id_type: idType, entered: "false" },
    images: [
      { image_type_id: 1, image: "", file_name: idImage.fileName },
      { image_type_id: 0, image: "", file_name: selfieImage.fileName },
    ],
    server_information: uploadData,
  };

  const zip = buildZip([
    { name: "info.json", data: Buffer.from(JSON.stringify(infoJson)) },
    { name: idImage.fileName, data: idImage.buffer },
    { name: selfieImage.fileName, data: selfieImage.buffer },
  ]);

  const putRes = await fetch(uploadData.upload_url, {
    method: "PUT",
    headers: { "Content-Type": "application/zip" },
    body: new Uint8Array(zip),
  });

  if (!putRes.ok) {
    throw new Error(`Smile ID zip upload failed (${putRes.status}).`);
  }

  const result = await pollJobStatus(partnerId, apiKey, base, userId, jobId);

  return {
    success: result?.job_success === true,
    resultCode: result?.result?.ResultCode ?? null,
    resultText: result?.result?.ResultText ?? null,
    actions: result?.result?.Actions ?? null,
    checkedAt: new Date().toISOString(),
  };
}

async function pollJobStatus(
  partnerId: string,
  apiKey: string,
  base: string,
  userId: string,
  jobId: string,
  maxAttempts = 8,
  intervalMs = 3000,
): Promise<JobStatusResponse | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));

    const timestamp = new Date().toISOString();
    const signature = generateSignature(partnerId, apiKey, timestamp);

    const res = await fetch(`${base}/job_status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: userId,
        job_id: jobId,
        partner_id: partnerId,
        history: false,
        image_links: false,
        signature,
        timestamp,
      }),
    });

    if (res.ok) {
      const data = (await res.json()) as JobStatusResponse;
      if (data.job_complete) return data;
    }
  }
  return null;
}
