-- Adiciona CHECK constraint em clickmassa_sync_status
-- Schema preexistente sem CHECK; tabela atualmente zerada permite ADD seguro
ALTER TABLE contacts
  ADD CONSTRAINT contacts_clickmassa_sync_status_check
  CHECK (clickmassa_sync_status IN ('pending', 'message_sent', 'opportunity_created', 'failed', 'blocked'));

-- Verificacao pos-ALTER
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'contacts'::regclass
  AND conname LIKE '%clickmassa%';
