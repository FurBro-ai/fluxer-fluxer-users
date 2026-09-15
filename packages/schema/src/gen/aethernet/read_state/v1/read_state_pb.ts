import type { GenFile, GenMessage } from "@bufbuild/protobuf/codegenv2";
import { fileDesc, messageDesc } from "@bufbuild/protobuf/codegenv2";
import type { Timestamp } from "@bufbuild/protobuf/wkt";
import { file_google_protobuf_timestamp } from "@bufbuild/protobuf/wkt";
import type { Message } from "@bufbuild/protobuf";

/**
 * Describes the file aethernet/read_state/v1/read_state.proto.
 */
export const file_aethernet_read_state_v1_read_state: GenFile = /*@__PURE__*/
  fileDesc("CihhZXRoZXJuZXQvcmVhZF9zdGF0ZS92MS9yZWFkX3N0YXRlLnByb3RvEhdhZXRoZXJuZXQucmVhZF9zdGF0ZS52MSLHAQoOUmVhZFN0YXRlRW50cnkSEgoKY2hhbm5lbF9pZBgBIAEoBBIcCg9sYXN0X21lc3NhZ2VfaWQYAiABKARIAIgBARIVCg1tZW50aW9uX2NvdW50GAMgASgNEjYKEmxhc3RfcGluX3RpbWVzdGFtcBgEIAEoCzIaLmdvb2dsZS5wcm90b2J1Zi5UaW1lc3RhbXASFAoHdmVyc2lvbhgFIAEoBEgBiAEBQhIKEF9sYXN0X21lc3NhZ2VfaWRCCgoIX3ZlcnNpb24iTwoPUmVhZFN0YXRlQnVuZGxlEjwKC3JlYWRfc3RhdGVzGAEgAygLMicuYWV0aGVybmV0LnJlYWRfc3RhdGUudjEuUmVhZFN0YXRlRW50cnliBnByb3RvMw", [file_google_protobuf_timestamp]);

/**
 * @generated from message aethernet.read_state.v1.ReadStateEntry
 */
export type ReadStateEntry = Message<"aethernet.read_state.v1.ReadStateEntry"> & {
  /**
   * @generated from field: uint64 channel_id = 1;
   */
  channelId: bigint;

  /**
   * @generated from field: optional uint64 last_message_id = 2;
   */
  lastMessageId?: bigint | undefined;

  /**
   * @generated from field: uint32 mention_count = 3;
   */
  mentionCount: number;

  /**
   * @generated from field: google.protobuf.Timestamp last_pin_timestamp = 4;
   */
  lastPinTimestamp?: Timestamp | undefined;

  /**
   * @generated from field: optional uint64 version = 5;
   */
  version?: bigint | undefined;
};

/**
 * Describes the message aethernet.read_state.v1.ReadStateEntry.
 * Use `create(ReadStateEntrySchema)` to create a new message.
 */
export const ReadStateEntrySchema: GenMessage<ReadStateEntry> = /*@__PURE__*/
  messageDesc(file_aethernet_read_state_v1_read_state, 0);

/**
 * @generated from message aethernet.read_state.v1.ReadStateBundle
 */
export type ReadStateBundle = Message<"aethernet.read_state.v1.ReadStateBundle"> & {
  /**
   * @generated from field: repeated aethernet.read_state.v1.ReadStateEntry read_states = 1;
   */
  readStates: ReadStateEntry[];
};

/**
 * Describes the message aethernet.read_state.v1.ReadStateBundle.
 * Use `create(ReadStateBundleSchema)` to create a new message.
 */
export const ReadStateBundleSchema: GenMessage<ReadStateBundle> = /*@__PURE__*/
  messageDesc(file_aethernet_read_state_v1_read_state, 1);
