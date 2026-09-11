import { AuditStatus } from './AuditStatus';
import { SettingsContent } from './SettingsSheet';
import { VerificationNote } from './VerificationNote';

export default function SettingsPage() {
  return (
    <section className="flex-1 py-4">
      <SettingsContent />
      <div className="mt-8 space-y-3">
        <VerificationNote />
        <AuditStatus />
      </div>
    </section>
  );
}
