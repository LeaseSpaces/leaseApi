-- Drop orphaned enum after Settings.smtpEncryption was removed (20260505183523_update_smtp_fields)
DROP TYPE IF EXISTS "SmtpEncryption";
