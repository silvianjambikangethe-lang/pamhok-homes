// Shared guest-contact-info validation, used by both the public booking
// form and the admin's manual/walk-in booking form so the two accept the
// same input shape.
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_RE = /^[0-9+()\-\s]{7,20}$/;
