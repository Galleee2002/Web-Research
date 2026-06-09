import { LEAD_STATUSES } from "@shared/index";
import type { LeadStatus } from "@shared/index";

import { leadStatusLabel } from "@/app/shared/model/status-label";
import { SelectMenu } from "@/app/shared/ui/select-menu";

export type ManualBusinessFormState = {
  name: string;
  category: string;
  email: string;
  phone: string;
  socialLinksText: string;
  website: string;
  mapsUrl: string;
  address: string;
  notes: string;
  status: LeadStatus;
};

interface ManualBusinessFormFieldsProps {
  idPrefix: string;
  form: ManualBusinessFormState;
  onFieldChange: <K extends keyof ManualBusinessFormState>(
    key: K,
    value: ManualBusinessFormState[K]
  ) => void;
}

export function ManualBusinessFormFields({
  idPrefix,
  form,
  onFieldChange
}: ManualBusinessFormFieldsProps) {
  return (
    <>
      <section className="business-modal__section">
        <h4 className="business-modal__subtitle">Business Info</h4>
        <div className="business-modal__form-grid">
          <label className="business-modal__form-field" htmlFor={`${idPrefix}-name`}>
            <span className="business-modal__label">Name</span>
            <input
              id={`${idPrefix}-name`}
              className="business-modal__text-input"
              type="text"
              value={form.name}
              onChange={(event) => onFieldChange("name", event.target.value)}
              autoComplete="organization"
              required
            />
          </label>
          <label className="business-modal__form-field" htmlFor={`${idPrefix}-category`}>
            <span className="business-modal__label">Category</span>
            <input
              id={`${idPrefix}-category`}
              className="business-modal__text-input"
              type="text"
              value={form.category}
              onChange={(event) => onFieldChange("category", event.target.value)}
              autoComplete="off"
            />
          </label>
        </div>
      </section>

      <section className="business-modal__section">
        <h4 className="business-modal__subtitle">Contact</h4>
        <div className="business-modal__form-grid">
          <label className="business-modal__form-field" htmlFor={`${idPrefix}-email`}>
            <span className="business-modal__label">Email</span>
            <input
              id={`${idPrefix}-email`}
              className="business-modal__text-input"
              type="email"
              value={form.email}
              onChange={(event) => onFieldChange("email", event.target.value)}
              autoComplete="email"
            />
          </label>
          <label className="business-modal__form-field" htmlFor={`${idPrefix}-phone`}>
            <span className="business-modal__label">Phone</span>
            <input
              id={`${idPrefix}-phone`}
              className="business-modal__text-input"
              type="tel"
              value={form.phone}
              onChange={(event) => onFieldChange("phone", event.target.value)}
              autoComplete="tel"
            />
          </label>
          <label
            className="business-modal__form-field business-modal__form-field--full"
            htmlFor={`${idPrefix}-website`}
          >
            <span className="business-modal__label">Website</span>
            <input
              id={`${idPrefix}-website`}
              className="business-modal__text-input"
              type="url"
              value={form.website}
              onChange={(event) => onFieldChange("website", event.target.value)}
              placeholder="https://example.com"
              autoComplete="url"
            />
          </label>
          <label
            className="business-modal__form-field business-modal__form-field--full"
            htmlFor={`${idPrefix}-social-links`}
          >
            <span className="business-modal__label">Social links</span>
            <textarea
              id={`${idPrefix}-social-links`}
              className="business-modal__notes-input business-modal__notes-input--compact"
              value={form.socialLinksText}
              onChange={(event) => onFieldChange("socialLinksText", event.target.value)}
              rows={3}
              placeholder="One URL per line (Instagram, Facebook, WhatsApp…)"
            />
          </label>
        </div>
      </section>

      <section className="business-modal__section">
        <h4 className="business-modal__subtitle">Location</h4>
        <div className="business-modal__form-grid">
          <label
            className="business-modal__form-field business-modal__form-field--full"
            htmlFor={`${idPrefix}-address`}
          >
            <span className="business-modal__label">Address</span>
            <input
              id={`${idPrefix}-address`}
              className="business-modal__text-input"
              type="text"
              value={form.address}
              onChange={(event) => onFieldChange("address", event.target.value)}
              autoComplete="street-address"
            />
          </label>
          <label
            className="business-modal__form-field business-modal__form-field--full"
            htmlFor={`${idPrefix}-maps-url`}
          >
            <span className="business-modal__label">Google Maps link</span>
            <input
              id={`${idPrefix}-maps-url`}
              className="business-modal__text-input"
              type="url"
              value={form.mapsUrl}
              onChange={(event) => onFieldChange("mapsUrl", event.target.value)}
              placeholder="https://maps.app.goo.gl/..."
              autoComplete="off"
            />
          </label>
        </div>
      </section>

      <section className="business-modal__section">
        <h4 className="business-modal__subtitle">Status</h4>
        <SelectMenu<LeadStatus>
          ariaLabel="Business status"
          value={form.status}
          onChange={(nextStatus) => onFieldChange("status", nextStatus)}
          rootClassName="business-modal__status-select"
          triggerClassName="businesses-select__trigger businesses-select__trigger--status"
          options={LEAD_STATUSES.map((status) => ({
            value: status,
            label: leadStatusLabel(status)
          }))}
          triggerContent={
            <span className="businesses-select__trigger-label">
              {leadStatusLabel(form.status)}
            </span>
          }
        />
      </section>

      <section className="business-modal__section business-modal__section--notes">
        <h4 className="business-modal__subtitle">Notes</h4>
        <textarea
          id={`${idPrefix}-notes`}
          className="business-modal__notes-input"
          value={form.notes}
          onChange={(event) => onFieldChange("notes", event.target.value)}
          rows={4}
          placeholder="Add internal notes for this business…"
        />
      </section>
    </>
  );
}
