CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS heureka_operation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_type varchar(50),
  account_id uuid,
  action varchar(120) NOT NULL,
  status varchar(50),
  idempotency_key varchar(160),
  actor_id varchar(120),
  entity_type varchar(80),
  entity_id varchar(120),
  product_id uuid,
  external_id varchar(160),
  correlation_id varchar(120),
  payload_hash varchar(128),
  request_summary jsonb,
  response_summary jsonb,
  policy_snapshot jsonb,
  blocked_reasons jsonb,
  error_summary varchar(1000),
  redacted_context jsonb,
  started_at timestamp(6),
  completed_at timestamp(6),
  created_at timestamp(6) NOT NULL DEFAULT now(),
  updated_at timestamp(6) NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS heureka_operation_events_idempotency_key_key
  ON heureka_operation_events(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS heureka_operation_events_action_idx ON heureka_operation_events(action);
CREATE INDEX IF NOT EXISTS heureka_operation_events_status_idx ON heureka_operation_events(status);
CREATE INDEX IF NOT EXISTS heureka_operation_events_feed_type_idx ON heureka_operation_events(feed_type);
CREATE INDEX IF NOT EXISTS heureka_operation_events_account_id_idx ON heureka_operation_events(account_id);
CREATE INDEX IF NOT EXISTS heureka_operation_events_product_id_idx ON heureka_operation_events(product_id);
CREATE INDEX IF NOT EXISTS heureka_operation_events_entity_type_entity_id_idx ON heureka_operation_events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS heureka_operation_events_external_id_idx ON heureka_operation_events(external_id);
CREATE INDEX IF NOT EXISTS heureka_operation_events_correlation_id_idx ON heureka_operation_events(correlation_id);
CREATE INDEX IF NOT EXISTS heureka_operation_events_created_at_idx ON heureka_operation_events(created_at);

CREATE OR REPLACE FUNCTION prevent_heureka_operation_event_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'heureka_operation_events is append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS heureka_operation_events_no_update ON heureka_operation_events;
CREATE TRIGGER heureka_operation_events_no_update
  BEFORE UPDATE ON heureka_operation_events
  FOR EACH ROW EXECUTE FUNCTION prevent_heureka_operation_event_mutation();

DROP TRIGGER IF EXISTS heureka_operation_events_no_delete ON heureka_operation_events;
CREATE TRIGGER heureka_operation_events_no_delete
  BEFORE DELETE ON heureka_operation_events
  FOR EACH ROW EXECUTE FUNCTION prevent_heureka_operation_event_mutation();
