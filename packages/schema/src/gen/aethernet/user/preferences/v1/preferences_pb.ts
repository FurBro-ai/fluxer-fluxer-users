import type { GenEnum, GenFile, GenMessage } from "@bufbuild/protobuf/codegenv2";
import { enumDesc, fileDesc, messageDesc } from "@bufbuild/protobuf/codegenv2";
import type { AccessibilityOverrides, AccessibilitySettings } from "./accessibility_pb";
import { file_aethernet_user_preferences_v1_accessibility } from "./accessibility_pb";
import type { EmojiPickerState, EmojiState, EmojiStickerLayoutSettings, FavoriteGifSettings, MemesPickerState, SoundSettings, StickerPickerState } from "./pickers_pb";
import { file_aethernet_user_preferences_v1_pickers } from "./pickers_pb";
import type { Message } from "@bufbuild/protobuf";

/**
 * Describes the file aethernet/user/preferences/v1/preferences.proto.
 */
export const file_aethernet_user_preferences_v1_preferences: GenFile = /*@__PURE__*/
  fileDesc("Ci9hZXRoZXJuZXQvdXNlci9wcmVmZXJlbmNlcy92MS9wcmVmZXJlbmNlcy5wcm90bxIdYWV0aGVybmV0LnVzZXIucHJlZmVyZW5jZXMudjEi9xQKEVN5bmNlZFByZWZlcmVuY2VzEksKDWFjY2Vzc2liaWxpdHkYASABKAsyNC5hZXRoZXJuZXQudXNlci5wcmVmZXJlbmNlcy52MS5BY2Nlc3NpYmlsaXR5U2V0dGluZ3MSVgoXYWNjZXNzaWJpbGl0eV9vdmVycmlkZXMYAiABKAsyNS5hZXRoZXJuZXQudXNlci5wcmVmZXJlbmNlcy52MS5BY2Nlc3NpYmlsaXR5T3ZlcnJpZGVzEk4KD3RleHR1YWxfcHJldmlldxgDIAEoCzI1LmFldGhlcm5ldC51c2VyLnByZWZlcmVuY2VzLnYxLlRleHR1YWxQcmV2aWV3U2V0dGluZ3MSRQoMZW1vamlfcGlja2VyGBQgASgLMi8uYWV0aGVybmV0LnVzZXIucHJlZmVyZW5jZXMudjEuRW1vamlQaWNrZXJTdGF0ZRJJCg5zdGlja2VyX3BpY2tlchgVIAEoCzIxLmFldGhlcm5ldC51c2VyLnByZWZlcmVuY2VzLnYxLlN0aWNrZXJQaWNrZXJTdGF0ZRJFCgxtZW1lc19waWNrZXIYFiABKAsyLy5hZXRoZXJuZXQudXNlci5wcmVmZXJlbmNlcy52MS5NZW1lc1BpY2tlclN0YXRlEjgKBWVtb2ppGBcgASgLMikuYWV0aGVybmV0LnVzZXIucHJlZmVyZW5jZXMudjEuRW1vamlTdGF0ZRJXChRlbW9qaV9zdGlja2VyX2xheW91dBgYIAEoCzI5LmFldGhlcm5ldC51c2VyLnByZWZlcmVuY2VzLnYxLkVtb2ppU3RpY2tlckxheW91dFNldHRpbmdzEkkKDWZhdm9yaXRlX2dpZnMYGSABKAsyMi5hZXRoZXJuZXQudXNlci5wcmVmZXJlbmNlcy52MS5GYXZvcml0ZUdpZlNldHRpbmdzEkAKCWZhdm9yaXRlcxgoIAEoCzItLmFldGhlcm5ldC51c2VyLnByZWZlcmVuY2VzLnYxLkZhdm9yaXRlc1N0YXRlEk4KD3JlY2VudF9tZW50aW9ucxgpIAEoCzI1LmFldGhlcm5ldC51c2VyLnByZWZlcmVuY2VzLnYxLlJlY2VudE1lbnRpb25zU2V0dGluZ3MSQgoHc2lkZWJhchgqIAEoCzIxLmFldGhlcm5ldC51c2VyLnByZWZlcmVuY2VzLnYxLlNpZGViYXJQcmVmZXJlbmNlcxJDCgttZW1iZXJfbGlzdBgrIAEoCzIuLmFldGhlcm5ldC51c2VyLnByZWZlcmVuY2VzLnYxLk1lbWJlckxpc3RTdGF0ZRJLCg91bnJlYWRfY2hhbm5lbHMYLCABKAsyMi5hZXRoZXJuZXQudXNlci5wcmVmZXJlbmNlcy52MS5VbnJlYWRDaGFubmVsc1N0YXRlEk0KEG1lbnRpb25fZnJlY2VuY3kYLSABKAsyMy5hZXRoZXJuZXQudXNlci5wcmVmZXJlbmNlcy52MS5NZW50aW9uRnJlY2VuY3lTdGF0ZRJACgduYWdiYXJzGDwgASgLMi8uYWV0aGVybmV0LnVzZXIucHJlZmVyZW5jZXMudjEuTmFnYmFyRGlzbWlzc2FscxJKChFkaXNtaXNzZWRfdXBzZWxscxg9IAEoCzIvLmFldGhlcm5ldC51c2VyLnByZWZlcmVuY2VzLnYxLkRpc21pc3NlZFVwc2VsbHMSUQoVZ3VpbGRfbnNmd19hZ3JlZW1lbnRzGD4gASgLMjIuYWV0aGVybmV0LnVzZXIucHJlZmVyZW5jZXMudjEuR3VpbGROc2Z3QWdyZWVtZW50cxI/Cgl3aGF0c19uZXcYPyABKAsyLC5hZXRoZXJuZXQudXNlci5wcmVmZXJlbmNlcy52MS5XaGF0c05ld1N0YXRlEkIKB3ByaXZhY3kYUCABKAsyMS5hZXRoZXJuZXQudXNlci5wcmVmZXJlbmNlcy52MS5Qcml2YWN5UHJlZmVyZW5jZXMSUwoUbG9jYWxfc3BhbV9vdmVycmlkZXMYUSABKAsyNS5hZXRoZXJuZXQudXNlci5wcmVmZXJlbmNlcy52MS5Mb2NhbFVzZXJTcGFtT3ZlcnJpZGVzEhUKDXNhbml0aXplX3VybHMYUiABKAgSOwoFc291bmQYZCABKAsyLC5hZXRoZXJuZXQudXNlci5wcmVmZXJlbmNlcy52MS5Tb3VuZFNldHRpbmdzEkUKCnNwZWxsY2hlY2sYZSABKAsyMS5hZXRoZXJuZXQudXNlci5wcmVmZXJlbmNlcy52MS5TcGVsbGNoZWNrU2V0dGluZ3MSSwoOc2VhcmNoX2VuZ2luZXMYZiABKAsyMy5hZXRoZXJuZXQudXNlci5wcmVmZXJlbmNlcy52MS5TZWFyY2hFbmdpbmVTZXR0aW5ncxJSChFwZXJtaXNzaW9uX2xheW91dBhnIAEoCzI3LmFldGhlcm5ldC51c2VyLnByZWZlcmVuY2VzLnYxLlBlcm1pc3Npb25MYXlvdXRTZXR0aW5ncxJVChNndWlsZF9tZW1iZXJfbGF5b3V0GGggASgLMjguYWV0aGVybmV0LnVzZXIucHJlZmVyZW5jZXMudjEuR3VpbGRNZW1iZXJMYXlvdXRTZXR0aW5ncxJOCg1ndWlsZF9mb2xkZXJzGGkgASgLMjcuYWV0aGVybmV0LnVzZXIucHJlZmVyZW5jZXMudjEuR3VpbGRGb2xkZXJFeHBhbmRlZFN0YXRlElMKFGhpZGRlbl9ndWlsZF9idXR0b25zGGogASgLMjUuYWV0aGVybmV0LnVzZXIucHJlZmVyZW5jZXMudjEuSGlkZGVuR3VpbGRMaXN0QnV0dG9ucxJSChNrZXlib2FyZF9tb2RlX2ludHJvGGsgASgLMjUuYWV0aGVybmV0LnVzZXIucHJlZmVyZW5jZXMudjEuS2V5Ym9hcmRNb2RlSW50cm9TdGF0ZRJUChBpbnB1dF9tb25pdG9yaW5nGGwgASgLMjouYWV0aGVybmV0LnVzZXIucHJlZmVyZW5jZXMudjEuSW5wdXRNb25pdG9yaW5nUHJvbXB0c1N0YXRlEkcKDXZvaWNlX3Byb21wdHMYbSABKAsyMC5hZXRoZXJuZXQudXNlci5wcmVmZXJlbmNlcy52MS5Wb2ljZVByb21wdHNTdGF0ZRJDCgtzdWRvX3Byb21wdBhuIAEoCzIuLmFldGhlcm5ldC51c2VyLnByZWZlcmVuY2VzLnYxLlN1ZG9Qcm9tcHRTdGF0ZRJACghrZXliaW5kcxhvIAEoCzIuLmFldGhlcm5ldC51c2VyLnByZWZlcmVuY2VzLnYxLktleWJpbmRTZXR0aW5ncxJECgpjaGF0X2lucHV0GHAgASgLMjAuYWV0aGVybmV0LnVzZXIucHJlZmVyZW5jZXMudjEuQ2hhdElucHV0U2V0dGluZ3MSKgodc2F2ZV9jYW1lcmFfdXBsb2Fkc190b19kZXZpY2UYcSABKAhIAIgBAUIgCh5fc2F2ZV9jYW1lcmFfdXBsb2Fkc190b19kZXZpY2UisAEKElNwZWxsY2hlY2tTZXR0aW5ncxIUCgdlbmFibGVkGAEgASgISACIAQESEQoJbGFuZ3VhZ2VzGAIgAygJEhsKE3BlcnNvbmFsX2RpY3Rpb25hcnkYAyADKAkSGAoLYXV0b19kZXRlY3QYBCABKAhIAYgBARITCgZlbmdpbmUYBSABKAlIAogBAUIKCghfZW5hYmxlZEIOCgxfYXV0b19kZXRlY3RCCQoHX2VuZ2luZSLmAQoUU2VhcmNoRW5naW5lU2V0dGluZ3MSIgoVdGV4dF9zZWFyY2hfZW5naW5lX2lkGAEgASgJSACIAQESKwoecmV2ZXJzZV9pbWFnZV9zZWFyY2hfZW5naW5lX2lkGAIgASgJSAGIAQESJAoXdHJhbnNsYXRpb25fcHJvdmlkZXJfaWQYAyABKAlIAogBAUIYChZfdGV4dF9zZWFyY2hfZW5naW5lX2lkQiEKH19yZXZlcnNlX2ltYWdlX3NlYXJjaF9lbmdpbmVfaWRCGgoYX3RyYW5zbGF0aW9uX3Byb3ZpZGVyX2lkIrUBChJQcml2YWN5UHJlZmVyZW5jZXMSHwoXZGlzYWJsZV9zdHJlYW1fcHJldmlld3MYASABKAgSHAoPc2hvd19hY3RpdmVfbm93GAIgASgISACIAQESKgodcHJldXBsb2FkX21lc3NhZ2VfYXR0YWNobWVudHMYAyABKAhIAYgBAUISChBfc2hvd19hY3RpdmVfbm93QiAKHl9wcmV1cGxvYWRfbWVzc2FnZV9hdHRhY2htZW50cyJQChZMb2NhbFVzZXJTcGFtT3ZlcnJpZGVzEhgKEHNwYW1tZXJfdXNlcl9pZHMYASADKAkSHAoUbm90X3NwYW1tZXJfdXNlcl9pZHMYAiADKAkiKwoWVGV4dHVhbFByZXZpZXdTZXR0aW5ncxIRCgl3cmFwX3RleHQYASABKAgi3AEKElNpZGViYXJQcmVmZXJlbmNlcxIcChRpbmxpbmVfZG1zX2NvbGxhcHNlZBgBIAEoCBIsCh9zaG93X2NvbGxhcHNlZF91bnJlYWRfZG1zX2JhZGdlGAIgASgISACIAQESLwoic2hvd19pbmNvbWluZ19mcmllbmRfcmVxdWVzdF9iYWRnZRgDIAEoCEgBiAEBQiIKIF9zaG93X2NvbGxhcHNlZF91bnJlYWRfZG1zX2JhZGdlQiUKI19zaG93X2luY29taW5nX2ZyaWVuZF9yZXF1ZXN0X2JhZGdlIj0KD01lbWJlckxpc3RTdGF0ZRIZCgxtZW1iZXJzX29wZW4YASABKAhIAIgBAUIPCg1fbWVtYmVyc19vcGVuIjQKE1VucmVhZENoYW5uZWxzU3RhdGUSHQoVY29sbGFwc2VkX2NoYW5uZWxfaWRzGAEgAygJIqoBChZSZWNlbnRNZW50aW9uc1NldHRpbmdzEh0KEGluY2x1ZGVfZXZlcnlvbmUYASABKAhIAIgBARIaCg1pbmNsdWRlX3JvbGVzGAIgASgISAGIAQESGwoOaW5jbHVkZV9ndWlsZHMYAyABKAhIAogBAUITChFfaW5jbHVkZV9ldmVyeW9uZUIQCg5faW5jbHVkZV9yb2xlc0IRCg9faW5jbHVkZV9ndWlsZHMihQIKFE1lbnRpb25GcmVjZW5jeVN0YXRlEkkKBnNjb3BlcxgBIAMoCzI5LmFldGhlcm5ldC51c2VyLnByZWZlcmVuY2VzLnYxLk1lbnRpb25GcmVjZW5jeVN0YXRlLlNjb3BlGjsKBUVudHJ5Eg8KB3VzZXJfaWQYASABKAkSDQoFY291bnQYAiABKA0SEgoKbGFzdF9hdF9tcxgDIAEoAxplCgVTY29wZRIQCghndWlsZF9pZBgBIAEoCRJKCgdlbnRyaWVzGAIgAygLMjkuYWV0aGVybmV0LnVzZXIucHJlZmVyZW5jZXMudjEuTWVudGlvbkZyZWNlbmN5U3RhdGUuRW50cnki4wEKDkZhdm9yaXRlc1N0YXRlEkAKCGNoYW5uZWxzGAEgAygLMi4uYWV0aGVybmV0LnVzZXIucHJlZmVyZW5jZXMudjEuRmF2b3JpdGVDaGFubmVsEkMKCmNhdGVnb3JpZXMYAiADKAsyLy5hZXRoZXJuZXQudXNlci5wcmVmZXJlbmNlcy52MS5GYXZvcml0ZUNhdGVnb3J5Eh4KFmNvbGxhcHNlZF9jYXRlZ29yeV9pZHMYAyADKAkSGwoTaGlkZV9tdXRlZF9jaGFubmVscxgEIAEoCBINCgVtdXRlZBgFIAEoCCKTAQoPRmF2b3JpdGVDaGFubmVsEhIKCmNoYW5uZWxfaWQYASABKAkSEAoIZ3VpbGRfaWQYAiABKAkSFgoJcGFyZW50X2lkGAMgASgJSACIAQESEAoIcG9zaXRpb24YBCABKAUSFQoIbmlja25hbWUYBSABKAlIAYgBAUIMCgpfcGFyZW50X2lkQgsKCV9uaWNrbmFtZSI+ChBGYXZvcml0ZUNhdGVnb3J5EgoKAmlkGAEgASgJEgwKBG5hbWUYAiABKAkSEAoIcG9zaXRpb24YAyABKAUiiQkKEE5hZ2JhckRpc21pc3NhbHMSEwoLaW9zX2luc3RhbGwYASABKAgSEwoLcHdhX2luc3RhbGwYAiABKAgSGQoRcHVzaF9ub3RpZmljYXRpb24YAyABKAgSHAoUZGVza3RvcF9ub3RpZmljYXRpb24YBCABKAgSHAoUcHJlbWl1bV9ncmFjZV9wZXJpb2QYBSABKAgSFwoPcHJlbWl1bV9leHBpcmVkGAYgASgIEhoKEnByZW1pdW1fb25ib2FyZGluZxgHIAEoCBIeChZwcmVtaXVtX3RyaWFsX2V4cGlyaW5nGAggASgIEhYKDmdpZnRfaW52ZW50b3J5GAkgASgIEhgKEGRlc2t0b3BfZG93bmxvYWQYCiABKAgSHAoUZ3VpbGRfbWVtYmVyc2hpcF9jdGEYCyABKAgSFQoNdmlzaW9uYXJ5X21mYRgMIAEoCBIbChNsZWdhY3lfcGhvbmVfdW5saW5rGA4gASgIEmcKFXBlbmRpbmdfYnVsa19kZWxldGlvbhgPIAMoCzJILmFldGhlcm5ldC51c2VyLnByZWZlcmVuY2VzLnYxLk5hZ2JhckRpc21pc3NhbHMuUGVuZGluZ0J1bGtEZWxldGlvbkVudHJ5El4KEGludml0ZXNfZGlzYWJsZWQYECADKAsyRC5hZXRoZXJuZXQudXNlci5wcmVmZXJlbmNlcy52MS5OYWdiYXJEaXNtaXNzYWxzLkludml0ZXNEaXNhYmxlZEVudHJ5EmcKFWd1aWxkX21mYV9yZXF1aXJlbWVudBgRIAMoCzJILmFldGhlcm5ldC51c2VyLnByZWZlcmVuY2VzLnYxLk5hZ2JhckRpc21pc3NhbHMuR3VpbGRNZmFSZXF1aXJlbWVudEVudHJ5EmIKEnByaWNlX2Fubm91bmNlbWVudBgSIAMoCzJGLmFldGhlcm5ldC51c2VyLnByZWZlcmVuY2VzLnYxLk5hZ2JhckRpc21pc3NhbHMuUHJpY2VBbm5vdW5jZW1lbnRFbnRyeRJiChNsZWdhY3lfcHJpY2Vfb3B0X2luGBMgAygLMkUuYWV0aGVybmV0LnVzZXIucHJlZmVyZW5jZXMudjEuTmFnYmFyRGlzbWlzc2Fscy5MZWdhY3lQcmljZU9wdEluRW50cnkaOgoYUGVuZGluZ0J1bGtEZWxldGlvbkVudHJ5EgsKA2tleRgBIAEoCRINCgV2YWx1ZRgCIAEoCDoCOAEaNgoUSW52aXRlc0Rpc2FibGVkRW50cnkSCwoDa2V5GAEgASgJEg0KBXZhbHVlGAIgASgIOgI4ARo6ChhHdWlsZE1mYVJlcXVpcmVtZW50RW50cnkSCwoDa2V5GAEgASgJEg0KBXZhbHVlGAIgASgIOgI4ARo4ChZQcmljZUFubm91bmNlbWVudEVudHJ5EgsKA2tleRgBIAEoCRINCgV2YWx1ZRgCIAEoCDoCOAEaNwoVTGVnYWN5UHJpY2VPcHRJbkVudHJ5EgsKA2tleRgBIAEoCRINCgV2YWx1ZRgCIAEoCDoCOAEiKgoQRGlzbWlzc2VkVXBzZWxscxIWCg5waWNrZXJfcHJlbWl1bRgBIAEoCCJoChNHdWlsZE5zZndBZ3JlZW1lbnRzEhoKEmFncmVlZF9jaGFubmVsX2lkcxgBIAMoCRIYChBhZ3JlZWRfZ3VpbGRfaWRzGAIgAygJEhsKE2FncmVlZF9jYXRlZ29yeV9pZHMYAyADKAkiUQoNV2hhdHNOZXdTdGF0ZRIkChdsYXN0X2Rpc21pc3NlZF9lbnRyeV9pZBgBIAEoCUgAiAEBQhoKGF9sYXN0X2Rpc21pc3NlZF9lbnRyeV9pZCKgAQoYUGVybWlzc2lvbkxheW91dFNldHRpbmdzEkMKBmxheW91dBgBIAEoDjIzLmFldGhlcm5ldC51c2VyLnByZWZlcmVuY2VzLnYxLlBlcm1pc3Npb25MYXlvdXRNb2RlEj8KBGdyaWQYAiABKA4yMS5hZXRoZXJuZXQudXNlci5wcmVmZXJlbmNlcy52MS5QZXJtaXNzaW9uR3JpZE1vZGUiXQoZR3VpbGRNZW1iZXJMYXlvdXRTZXR0aW5ncxJACgRtb2RlGAEgASgOMjIuYWV0aGVybmV0LnVzZXIucHJlZmVyZW5jZXMudjEuR3VpbGRNZW1iZXJWaWV3TW9kZSI3ChhHdWlsZEZvbGRlckV4cGFuZGVkU3RhdGUSGwoTZXhwYW5kZWRfZm9sZGVyX2lkcxgBIAMoBiJGChZIaWRkZW5HdWlsZExpc3RCdXR0b25zEhcKD2Rvd25sb2FkX2J1dHRvbhgBIAEoCBITCgtoZWxwX2J1dHRvbhgCIAEoCCImChZLZXlib2FyZE1vZGVJbnRyb1N0YXRlEgwKBHNlZW4YASABKAgiLwobSW5wdXRNb25pdG9yaW5nUHJvbXB0c1N0YXRlEhAKCHNlZW5fY3RhGAEgASgIImQKEVZvaWNlUHJvbXB0c1N0YXRlEiQKHHNraXBfaGlkZV9vd25fY2FtZXJhX2NvbmZpcm0YASABKAgSKQohc2tpcF9oaWRlX293bl9zY3JlZW5zaGFyZV9jb25maXJtGAIgASgIIncKD1N1ZG9Qcm9tcHRTdGF0ZRJLChRsYXN0X3VzZWRfbWZhX21ldGhvZBgBIAEoDjIoLmFldGhlcm5ldC51c2VyLnByZWZlcmVuY2VzLnYxLk1mYU1ldGhvZEgAiAEBQhcKFV9sYXN0X3VzZWRfbWZhX21ldGhvZCK9AQoPS2V5YmluZFNldHRpbmdzEkUKD2N1c3RvbV9rZXliaW5kcxgBIAMoCzIsLmFldGhlcm5ldC51c2VyLnByZWZlcmVuY2VzLnYxLkN1c3RvbUtleWJpbmQSFQoNdHJhbnNtaXRfbW9kZRgCIAEoCRIqCh1wdXNoX3RvX3RhbGtfcmVsZWFzZV9kZWxheV9tcxgDIAEoDUgAiAEBQiAKHl9wdXNoX3RvX3RhbGtfcmVsZWFzZV9kZWxheV9tcyKIAQoNQ3VzdG9tS2V5YmluZBIKCgJpZBgBIAEoCRITCgZhY3Rpb24YAiABKAlIAIgBARI6CgVjb21ibxgDIAEoCzIrLmFldGhlcm5ldC51c2VyLnByZWZlcmVuY2VzLnYxLktleWJpbmRDb21ibxIPCgdlbmFibGVkGAQgASgIQgkKB19hY3Rpb24izgIKDEtleWJpbmRDb21ibxILCgNrZXkYASABKAkSEQoEY29kZRgCIAEoCUgAiAEBEhQKDGN0cmxfb3JfbWV0YRgDIAEoCBIMCgRjdHJsGAQgASgIEgsKA2FsdBgFIAEoCBINCgVzaGlmdBgGIAEoCBIMCgRtZXRhGAcgASgIEhMKBmdsb2JhbBgIIAEoCEgBiAEBEhQKB2VuYWJsZWQYCSABKAhIAogBARIVCg1tb2RpZmllcl9vbmx5GAogASgIEhIKCmJvdGhfc2lkZXMYCyABKAgSGQoMbW91c2VfYnV0dG9uGAwgASgNSAOIAQESGwoOZ2FtZXBhZF9idXR0b24YDSABKA1IBIgBAUIHCgVfY29kZUIJCgdfZ2xvYmFsQgoKCF9lbmFibGVkQg8KDV9tb3VzZV9idXR0b25CEQoPX2dhbWVwYWRfYnV0dG9uIkkKEUNoYXRJbnB1dFNldHRpbmdzEh4KEWNvbnZlcnRfZW1vdGljb25zGAEgASgISACIAQFCFAoSX2NvbnZlcnRfZW1vdGljb25zKoIBChRQZXJtaXNzaW9uTGF5b3V0TW9kZRImCiJQRVJNSVNTSU9OX0xBWU9VVF9NT0RFX1VOU1BFQ0lGSUVEEAASIAocUEVSTUlTU0lPTl9MQVlPVVRfTU9ERV9DT01GWRABEiAKHFBFUk1JU1NJT05fTEFZT1VUX01PREVfREVOU0UQAip6ChJQZXJtaXNzaW9uR3JpZE1vZGUSJAogUEVSTUlTU0lPTl9HUklEX01PREVfVU5TUEVDSUZJRUQQABIfChtQRVJNSVNTSU9OX0dSSURfTU9ERV9TSU5HTEUQARIdChlQRVJNSVNTSU9OX0dSSURfTU9ERV9HUklEEAIqgAEKE0d1aWxkTWVtYmVyVmlld01vZGUSJgoiR1VJTERfTUVNQkVSX1ZJRVdfTU9ERV9VTlNQRUNJRklFRBAAEiAKHEdVSUxEX01FTUJFUl9WSUVXX01PREVfVEFCTEUQARIfChtHVUlMRF9NRU1CRVJfVklFV19NT0RFX0dSSUQQAipVCglNZmFNZXRob2QSGgoWTUZBX01FVEhPRF9VTlNQRUNJRklFRBAAEhMKD01GQV9NRVRIT0RfVE9UUBABEhcKE01GQV9NRVRIT0RfV0VCQVVUSE4QA2IGcHJvdG8z", [file_aethernet_user_preferences_v1_accessibility, file_aethernet_user_preferences_v1_pickers]);

/**
 * @generated from message aethernet.user.preferences.v1.SyncedPreferences
 */
export type SyncedPreferences = Message<"aethernet.user.preferences.v1.SyncedPreferences"> & {
  /**
   * @generated from field: aethernet.user.preferences.v1.AccessibilitySettings accessibility = 1;
   */
  accessibility?: AccessibilitySettings | undefined;

  /**
   * @generated from field: aethernet.user.preferences.v1.AccessibilityOverrides accessibility_overrides = 2;
   */
  accessibilityOverrides?: AccessibilityOverrides | undefined;

  /**
   * @generated from field: aethernet.user.preferences.v1.TextualPreviewSettings textual_preview = 3;
   */
  textualPreview?: TextualPreviewSettings | undefined;

  /**
   * @generated from field: aethernet.user.preferences.v1.EmojiPickerState emoji_picker = 20;
   */
  emojiPicker?: EmojiPickerState | undefined;

  /**
   * @generated from field: aethernet.user.preferences.v1.StickerPickerState sticker_picker = 21;
   */
  stickerPicker?: StickerPickerState | undefined;

  /**
   * @generated from field: aethernet.user.preferences.v1.MemesPickerState memes_picker = 22;
   */
  memesPicker?: MemesPickerState | undefined;

  /**
   * @generated from field: aethernet.user.preferences.v1.EmojiState emoji = 23;
   */
  emoji?: EmojiState | undefined;

  /**
   * @generated from field: aethernet.user.preferences.v1.EmojiStickerLayoutSettings emoji_sticker_layout = 24;
   */
  emojiStickerLayout?: EmojiStickerLayoutSettings | undefined;

  /**
   * @generated from field: aethernet.user.preferences.v1.FavoriteGifSettings favorite_gifs = 25;
   */
  favoriteGifs?: FavoriteGifSettings | undefined;

  /**
   * @generated from field: aethernet.user.preferences.v1.FavoritesState favorites = 40;
   */
  favorites?: FavoritesState | undefined;

  /**
   * @generated from field: aethernet.user.preferences.v1.RecentMentionsSettings recent_mentions = 41;
   */
  recentMentions?: RecentMentionsSettings | undefined;

  /**
   * @generated from field: aethernet.user.preferences.v1.SidebarPreferences sidebar = 42;
   */
  sidebar?: SidebarPreferences | undefined;

  /**
   * @generated from field: aethernet.user.preferences.v1.MemberListState member_list = 43;
   */
  memberList?: MemberListState | undefined;

  /**
   * @generated from field: aethernet.user.preferences.v1.UnreadChannelsState unread_channels = 44;
   */
  unreadChannels?: UnreadChannelsState | undefined;

  /**
   * @generated from field: aethernet.user.preferences.v1.MentionFrecencyState mention_frecency = 45;
   */
  mentionFrecency?: MentionFrecencyState | undefined;

  /**
   * @generated from field: aethernet.user.preferences.v1.NagbarDismissals nagbars = 60;
   */
  nagbars?: NagbarDismissals | undefined;

  /**
   * @generated from field: aethernet.user.preferences.v1.DismissedUpsells dismissed_upsells = 61;
   */
  dismissedUpsells?: DismissedUpsells | undefined;

  /**
   * @generated from field: aethernet.user.preferences.v1.GuildNsfwAgreements guild_nsfw_agreements = 62;
   */
  guildNsfwAgreements?: GuildNsfwAgreements | undefined;

  /**
   * @generated from field: aethernet.user.preferences.v1.WhatsNewState whats_new = 63;
   */
  whatsNew?: WhatsNewState | undefined;

  /**
   * @generated from field: aethernet.user.preferences.v1.PrivacyPreferences privacy = 80;
   */
  privacy?: PrivacyPreferences | undefined;

  /**
   * @generated from field: aethernet.user.preferences.v1.LocalUserSpamOverrides local_spam_overrides = 81;
   */
  localSpamOverrides?: LocalUserSpamOverrides | undefined;

  /**
   * @generated from field: bool sanitize_urls = 82;
   */
  sanitizeUrls: boolean;

  /**
   * @generated from field: aethernet.user.preferences.v1.SoundSettings sound = 100;
   */
  sound?: SoundSettings | undefined;

  /**
   * @generated from field: aethernet.user.preferences.v1.SpellcheckSettings spellcheck = 101;
   */
  spellcheck?: SpellcheckSettings | undefined;

  /**
   * @generated from field: aethernet.user.preferences.v1.SearchEngineSettings search_engines = 102;
   */
  searchEngines?: SearchEngineSettings | undefined;

  /**
   * @generated from field: aethernet.user.preferences.v1.PermissionLayoutSettings permission_layout = 103;
   */
  permissionLayout?: PermissionLayoutSettings | undefined;

  /**
   * @generated from field: aethernet.user.preferences.v1.GuildMemberLayoutSettings guild_member_layout = 104;
   */
  guildMemberLayout?: GuildMemberLayoutSettings | undefined;

  /**
   * @generated from field: aethernet.user.preferences.v1.GuildFolderExpandedState guild_folders = 105;
   */
  guildFolders?: GuildFolderExpandedState | undefined;

  /**
   * @generated from field: aethernet.user.preferences.v1.HiddenGuildListButtons hidden_guild_buttons = 106;
   */
  hiddenGuildButtons?: HiddenGuildListButtons | undefined;

  /**
   * @generated from field: aethernet.user.preferences.v1.KeyboardModeIntroState keyboard_mode_intro = 107;
   */
  keyboardModeIntro?: KeyboardModeIntroState | undefined;

  /**
   * @generated from field: aethernet.user.preferences.v1.InputMonitoringPromptsState input_monitoring = 108;
   */
  inputMonitoring?: InputMonitoringPromptsState | undefined;

  /**
   * @generated from field: aethernet.user.preferences.v1.VoicePromptsState voice_prompts = 109;
   */
  voicePrompts?: VoicePromptsState | undefined;

  /**
   * @generated from field: aethernet.user.preferences.v1.SudoPromptState sudo_prompt = 110;
   */
  sudoPrompt?: SudoPromptState | undefined;

  /**
   * @generated from field: aethernet.user.preferences.v1.KeybindSettings keybinds = 111;
   */
  keybinds?: KeybindSettings | undefined;

  /**
   * @generated from field: aethernet.user.preferences.v1.ChatInputSettings chat_input = 112;
   */
  chatInput?: ChatInputSettings | undefined;

  /**
   * @generated from field: optional bool save_camera_uploads_to_device = 113;
   */
  saveCameraUploadsToDevice?: boolean | undefined;
};

/**
 * Describes the message aethernet.user.preferences.v1.SyncedPreferences.
 * Use `create(SyncedPreferencesSchema)` to create a new message.
 */
export const SyncedPreferencesSchema: GenMessage<SyncedPreferences> = /*@__PURE__*/
  messageDesc(file_aethernet_user_preferences_v1_preferences, 0);

/**
 * @generated from message aethernet.user.preferences.v1.SpellcheckSettings
 */
export type SpellcheckSettings = Message<"aethernet.user.preferences.v1.SpellcheckSettings"> & {
  /**
   * @generated from field: optional bool enabled = 1;
   */
  enabled?: boolean | undefined;

  /**
   * @generated from field: repeated string languages = 2;
   */
  languages: string[];

  /**
   * @generated from field: repeated string personal_dictionary = 3;
   */
  personalDictionary: string[];

  /**
   * @generated from field: optional bool auto_detect = 4;
   */
  autoDetect?: boolean | undefined;

  /**
   * @generated from field: optional string engine = 5;
   */
  engine?: string | undefined;
};

/**
 * Describes the message aethernet.user.preferences.v1.SpellcheckSettings.
 * Use `create(SpellcheckSettingsSchema)` to create a new message.
 */
export const SpellcheckSettingsSchema: GenMessage<SpellcheckSettings> = /*@__PURE__*/
  messageDesc(file_aethernet_user_preferences_v1_preferences, 1);

/**
 * @generated from message aethernet.user.preferences.v1.SearchEngineSettings
 */
export type SearchEngineSettings = Message<"aethernet.user.preferences.v1.SearchEngineSettings"> & {
  /**
   * @generated from field: optional string text_search_engine_id = 1;
   */
  textSearchEngineId?: string | undefined;

  /**
   * @generated from field: optional string reverse_image_search_engine_id = 2;
   */
  reverseImageSearchEngineId?: string | undefined;

  /**
   * @generated from field: optional string translation_provider_id = 3;
   */
  translationProviderId?: string | undefined;
};

/**
 * Describes the message aethernet.user.preferences.v1.SearchEngineSettings.
 * Use `create(SearchEngineSettingsSchema)` to create a new message.
 */
export const SearchEngineSettingsSchema: GenMessage<SearchEngineSettings> = /*@__PURE__*/
  messageDesc(file_aethernet_user_preferences_v1_preferences, 2);

/**
 * @generated from message aethernet.user.preferences.v1.PrivacyPreferences
 */
export type PrivacyPreferences = Message<"aethernet.user.preferences.v1.PrivacyPreferences"> & {
  /**
   * @generated from field: bool disable_stream_previews = 1;
   */
  disableStreamPreviews: boolean;

  /**
   * @generated from field: optional bool show_active_now = 2;
   */
  showActiveNow?: boolean | undefined;

  /**
   * @generated from field: optional bool preupload_message_attachments = 3;
   */
  preuploadMessageAttachments?: boolean | undefined;
};

/**
 * Describes the message aethernet.user.preferences.v1.PrivacyPreferences.
 * Use `create(PrivacyPreferencesSchema)` to create a new message.
 */
export const PrivacyPreferencesSchema: GenMessage<PrivacyPreferences> = /*@__PURE__*/
  messageDesc(file_aethernet_user_preferences_v1_preferences, 3);

/**
 * @generated from message aethernet.user.preferences.v1.LocalUserSpamOverrides
 */
export type LocalUserSpamOverrides = Message<"aethernet.user.preferences.v1.LocalUserSpamOverrides"> & {
  /**
   * @generated from field: repeated string spammer_user_ids = 1;
   */
  spammerUserIds: string[];

  /**
   * @generated from field: repeated string not_spammer_user_ids = 2;
   */
  notSpammerUserIds: string[];
};

/**
 * Describes the message aethernet.user.preferences.v1.LocalUserSpamOverrides.
 * Use `create(LocalUserSpamOverridesSchema)` to create a new message.
 */
export const LocalUserSpamOverridesSchema: GenMessage<LocalUserSpamOverrides> = /*@__PURE__*/
  messageDesc(file_aethernet_user_preferences_v1_preferences, 4);

/**
 * @generated from message aethernet.user.preferences.v1.TextualPreviewSettings
 */
export type TextualPreviewSettings = Message<"aethernet.user.preferences.v1.TextualPreviewSettings"> & {
  /**
   * @generated from field: bool wrap_text = 1;
   */
  wrapText: boolean;
};

/**
 * Describes the message aethernet.user.preferences.v1.TextualPreviewSettings.
 * Use `create(TextualPreviewSettingsSchema)` to create a new message.
 */
export const TextualPreviewSettingsSchema: GenMessage<TextualPreviewSettings> = /*@__PURE__*/
  messageDesc(file_aethernet_user_preferences_v1_preferences, 5);

/**
 * @generated from message aethernet.user.preferences.v1.SidebarPreferences
 */
export type SidebarPreferences = Message<"aethernet.user.preferences.v1.SidebarPreferences"> & {
  /**
   * @generated from field: bool inline_dms_collapsed = 1;
   */
  inlineDmsCollapsed: boolean;

  /**
   * @generated from field: optional bool show_collapsed_unread_dms_badge = 2;
   */
  showCollapsedUnreadDmsBadge?: boolean | undefined;

  /**
   * @generated from field: optional bool show_incoming_friend_request_badge = 3;
   */
  showIncomingFriendRequestBadge?: boolean | undefined;
};

/**
 * Describes the message aethernet.user.preferences.v1.SidebarPreferences.
 * Use `create(SidebarPreferencesSchema)` to create a new message.
 */
export const SidebarPreferencesSchema: GenMessage<SidebarPreferences> = /*@__PURE__*/
  messageDesc(file_aethernet_user_preferences_v1_preferences, 6);

/**
 * @generated from message aethernet.user.preferences.v1.MemberListState
 */
export type MemberListState = Message<"aethernet.user.preferences.v1.MemberListState"> & {
  /**
   * @generated from field: optional bool members_open = 1;
   */
  membersOpen?: boolean | undefined;
};

/**
 * Describes the message aethernet.user.preferences.v1.MemberListState.
 * Use `create(MemberListStateSchema)` to create a new message.
 */
export const MemberListStateSchema: GenMessage<MemberListState> = /*@__PURE__*/
  messageDesc(file_aethernet_user_preferences_v1_preferences, 7);

/**
 * @generated from message aethernet.user.preferences.v1.UnreadChannelsState
 */
export type UnreadChannelsState = Message<"aethernet.user.preferences.v1.UnreadChannelsState"> & {
  /**
   * @generated from field: repeated string collapsed_channel_ids = 1;
   */
  collapsedChannelIds: string[];
};

/**
 * Describes the message aethernet.user.preferences.v1.UnreadChannelsState.
 * Use `create(UnreadChannelsStateSchema)` to create a new message.
 */
export const UnreadChannelsStateSchema: GenMessage<UnreadChannelsState> = /*@__PURE__*/
  messageDesc(file_aethernet_user_preferences_v1_preferences, 8);

/**
 * @generated from message aethernet.user.preferences.v1.RecentMentionsSettings
 */
export type RecentMentionsSettings = Message<"aethernet.user.preferences.v1.RecentMentionsSettings"> & {
  /**
   * @generated from field: optional bool include_everyone = 1;
   */
  includeEveryone?: boolean | undefined;

  /**
   * @generated from field: optional bool include_roles = 2;
   */
  includeRoles?: boolean | undefined;

  /**
   * @generated from field: optional bool include_guilds = 3;
   */
  includeGuilds?: boolean | undefined;
};

/**
 * Describes the message aethernet.user.preferences.v1.RecentMentionsSettings.
 * Use `create(RecentMentionsSettingsSchema)` to create a new message.
 */
export const RecentMentionsSettingsSchema: GenMessage<RecentMentionsSettings> = /*@__PURE__*/
  messageDesc(file_aethernet_user_preferences_v1_preferences, 9);

/**
 * @generated from message aethernet.user.preferences.v1.MentionFrecencyState
 */
export type MentionFrecencyState = Message<"aethernet.user.preferences.v1.MentionFrecencyState"> & {
  /**
   * @generated from field: repeated aethernet.user.preferences.v1.MentionFrecencyState.Scope scopes = 1;
   */
  scopes: MentionFrecencyState_Scope[];
};

/**
 * Describes the message aethernet.user.preferences.v1.MentionFrecencyState.
 * Use `create(MentionFrecencyStateSchema)` to create a new message.
 */
export const MentionFrecencyStateSchema: GenMessage<MentionFrecencyState> = /*@__PURE__*/
  messageDesc(file_aethernet_user_preferences_v1_preferences, 10);

/**
 * @generated from message aethernet.user.preferences.v1.MentionFrecencyState.Entry
 */
export type MentionFrecencyState_Entry = Message<"aethernet.user.preferences.v1.MentionFrecencyState.Entry"> & {
  /**
   * @generated from field: string user_id = 1;
   */
  userId: string;

  /**
   * @generated from field: uint32 count = 2;
   */
  count: number;

  /**
   * @generated from field: int64 last_at_ms = 3;
   */
  lastAtMs: bigint;
};

/**
 * Describes the message aethernet.user.preferences.v1.MentionFrecencyState.Entry.
 * Use `create(MentionFrecencyState_EntrySchema)` to create a new message.
 */
export const MentionFrecencyState_EntrySchema: GenMessage<MentionFrecencyState_Entry> = /*@__PURE__*/
  messageDesc(file_aethernet_user_preferences_v1_preferences, 10, 0);

/**
 * @generated from message aethernet.user.preferences.v1.MentionFrecencyState.Scope
 */
export type MentionFrecencyState_Scope = Message<"aethernet.user.preferences.v1.MentionFrecencyState.Scope"> & {
  /**
   * @generated from field: string guild_id = 1;
   */
  guildId: string;

  /**
   * @generated from field: repeated aethernet.user.preferences.v1.MentionFrecencyState.Entry entries = 2;
   */
  entries: MentionFrecencyState_Entry[];
};

/**
 * Describes the message aethernet.user.preferences.v1.MentionFrecencyState.Scope.
 * Use `create(MentionFrecencyState_ScopeSchema)` to create a new message.
 */
export const MentionFrecencyState_ScopeSchema: GenMessage<MentionFrecencyState_Scope> = /*@__PURE__*/
  messageDesc(file_aethernet_user_preferences_v1_preferences, 10, 1);

/**
 * @generated from message aethernet.user.preferences.v1.FavoritesState
 */
export type FavoritesState = Message<"aethernet.user.preferences.v1.FavoritesState"> & {
  /**
   * @generated from field: repeated aethernet.user.preferences.v1.FavoriteChannel channels = 1;
   */
  channels: FavoriteChannel[];

  /**
   * @generated from field: repeated aethernet.user.preferences.v1.FavoriteCategory categories = 2;
   */
  categories: FavoriteCategory[];

  /**
   * @generated from field: repeated string collapsed_category_ids = 3;
   */
  collapsedCategoryIds: string[];

  /**
   * @generated from field: bool hide_muted_channels = 4;
   */
  hideMutedChannels: boolean;

  /**
   * @generated from field: bool muted = 5;
   */
  muted: boolean;
};

/**
 * Describes the message aethernet.user.preferences.v1.FavoritesState.
 * Use `create(FavoritesStateSchema)` to create a new message.
 */
export const FavoritesStateSchema: GenMessage<FavoritesState> = /*@__PURE__*/
  messageDesc(file_aethernet_user_preferences_v1_preferences, 11);

/**
 * @generated from message aethernet.user.preferences.v1.FavoriteChannel
 */
export type FavoriteChannel = Message<"aethernet.user.preferences.v1.FavoriteChannel"> & {
  /**
   * @generated from field: string channel_id = 1;
   */
  channelId: string;

  /**
   * @generated from field: string guild_id = 2;
   */
  guildId: string;

  /**
   * @generated from field: optional string parent_id = 3;
   */
  parentId?: string | undefined;

  /**
   * @generated from field: int32 position = 4;
   */
  position: number;

  /**
   * @generated from field: optional string nickname = 5;
   */
  nickname?: string | undefined;
};

/**
 * Describes the message aethernet.user.preferences.v1.FavoriteChannel.
 * Use `create(FavoriteChannelSchema)` to create a new message.
 */
export const FavoriteChannelSchema: GenMessage<FavoriteChannel> = /*@__PURE__*/
  messageDesc(file_aethernet_user_preferences_v1_preferences, 12);

/**
 * @generated from message aethernet.user.preferences.v1.FavoriteCategory
 */
export type FavoriteCategory = Message<"aethernet.user.preferences.v1.FavoriteCategory"> & {
  /**
   * @generated from field: string id = 1;
   */
  id: string;

  /**
   * @generated from field: string name = 2;
   */
  name: string;

  /**
   * @generated from field: int32 position = 3;
   */
  position: number;
};

/**
 * Describes the message aethernet.user.preferences.v1.FavoriteCategory.
 * Use `create(FavoriteCategorySchema)` to create a new message.
 */
export const FavoriteCategorySchema: GenMessage<FavoriteCategory> = /*@__PURE__*/
  messageDesc(file_aethernet_user_preferences_v1_preferences, 13);

/**
 * @generated from message aethernet.user.preferences.v1.NagbarDismissals
 */
export type NagbarDismissals = Message<"aethernet.user.preferences.v1.NagbarDismissals"> & {
  /**
   * @generated from field: bool ios_install = 1;
   */
  iosInstall: boolean;

  /**
   * @generated from field: bool pwa_install = 2;
   */
  pwaInstall: boolean;

  /**
   * @generated from field: bool push_notification = 3;
   */
  pushNotification: boolean;

  /**
   * @generated from field: bool desktop_notification = 4;
   */
  desktopNotification: boolean;

  /**
   * @generated from field: bool premium_grace_period = 5;
   */
  premiumGracePeriod: boolean;

  /**
   * @generated from field: bool premium_expired = 6;
   */
  premiumExpired: boolean;

  /**
   * @generated from field: bool premium_onboarding = 7;
   */
  premiumOnboarding: boolean;

  /**
   * @generated from field: bool premium_trial_expiring = 8;
   */
  premiumTrialExpiring: boolean;

  /**
   * @generated from field: bool gift_inventory = 9;
   */
  giftInventory: boolean;

  /**
   * @generated from field: bool desktop_download = 10;
   */
  desktopDownload: boolean;

  /**
   * @generated from field: bool guild_membership_cta = 11;
   */
  guildMembershipCta: boolean;

  /**
   * @generated from field: bool visionary_mfa = 12;
   */
  visionaryMfa: boolean;

  /**
   * @generated from field: bool legacy_phone_unlink = 14;
   */
  legacyPhoneUnlink: boolean;

  /**
   * @generated from field: map<string, bool> pending_bulk_deletion = 15;
   */
  pendingBulkDeletion: { [key: string]: boolean };

  /**
   * @generated from field: map<string, bool> invites_disabled = 16;
   */
  invitesDisabled: { [key: string]: boolean };

  /**
   * @generated from field: map<string, bool> guild_mfa_requirement = 17;
   */
  guildMfaRequirement: { [key: string]: boolean };

  /**
   * @generated from field: map<string, bool> price_announcement = 18;
   */
  priceAnnouncement: { [key: string]: boolean };

  /**
   * @generated from field: map<string, bool> legacy_price_opt_in = 19;
   */
  legacyPriceOptIn: { [key: string]: boolean };
};

/**
 * Describes the message aethernet.user.preferences.v1.NagbarDismissals.
 * Use `create(NagbarDismissalsSchema)` to create a new message.
 */
export const NagbarDismissalsSchema: GenMessage<NagbarDismissals> = /*@__PURE__*/
  messageDesc(file_aethernet_user_preferences_v1_preferences, 14);

/**
 * @generated from message aethernet.user.preferences.v1.DismissedUpsells
 */
export type DismissedUpsells = Message<"aethernet.user.preferences.v1.DismissedUpsells"> & {
  /**
   * @generated from field: bool picker_premium = 1;
   */
  pickerPremium: boolean;
};

/**
 * Describes the message aethernet.user.preferences.v1.DismissedUpsells.
 * Use `create(DismissedUpsellsSchema)` to create a new message.
 */
export const DismissedUpsellsSchema: GenMessage<DismissedUpsells> = /*@__PURE__*/
  messageDesc(file_aethernet_user_preferences_v1_preferences, 15);

/**
 * @generated from message aethernet.user.preferences.v1.GuildNsfwAgreements
 */
export type GuildNsfwAgreements = Message<"aethernet.user.preferences.v1.GuildNsfwAgreements"> & {
  /**
   * @generated from field: repeated string agreed_channel_ids = 1;
   */
  agreedChannelIds: string[];

  /**
   * @generated from field: repeated string agreed_guild_ids = 2;
   */
  agreedGuildIds: string[];

  /**
   * @generated from field: repeated string agreed_category_ids = 3;
   */
  agreedCategoryIds: string[];
};

/**
 * Describes the message aethernet.user.preferences.v1.GuildNsfwAgreements.
 * Use `create(GuildNsfwAgreementsSchema)` to create a new message.
 */
export const GuildNsfwAgreementsSchema: GenMessage<GuildNsfwAgreements> = /*@__PURE__*/
  messageDesc(file_aethernet_user_preferences_v1_preferences, 16);

/**
 * @generated from message aethernet.user.preferences.v1.WhatsNewState
 */
export type WhatsNewState = Message<"aethernet.user.preferences.v1.WhatsNewState"> & {
  /**
   * @generated from field: optional string last_dismissed_entry_id = 1;
   */
  lastDismissedEntryId?: string | undefined;
};

/**
 * Describes the message aethernet.user.preferences.v1.WhatsNewState.
 * Use `create(WhatsNewStateSchema)` to create a new message.
 */
export const WhatsNewStateSchema: GenMessage<WhatsNewState> = /*@__PURE__*/
  messageDesc(file_aethernet_user_preferences_v1_preferences, 17);

/**
 * @generated from message aethernet.user.preferences.v1.PermissionLayoutSettings
 */
export type PermissionLayoutSettings = Message<"aethernet.user.preferences.v1.PermissionLayoutSettings"> & {
  /**
   * @generated from field: aethernet.user.preferences.v1.PermissionLayoutMode layout = 1;
   */
  layout: PermissionLayoutMode;

  /**
   * @generated from field: aethernet.user.preferences.v1.PermissionGridMode grid = 2;
   */
  grid: PermissionGridMode;
};

/**
 * Describes the message aethernet.user.preferences.v1.PermissionLayoutSettings.
 * Use `create(PermissionLayoutSettingsSchema)` to create a new message.
 */
export const PermissionLayoutSettingsSchema: GenMessage<PermissionLayoutSettings> = /*@__PURE__*/
  messageDesc(file_aethernet_user_preferences_v1_preferences, 18);

/**
 * @generated from message aethernet.user.preferences.v1.GuildMemberLayoutSettings
 */
export type GuildMemberLayoutSettings = Message<"aethernet.user.preferences.v1.GuildMemberLayoutSettings"> & {
  /**
   * @generated from field: aethernet.user.preferences.v1.GuildMemberViewMode mode = 1;
   */
  mode: GuildMemberViewMode;
};

/**
 * Describes the message aethernet.user.preferences.v1.GuildMemberLayoutSettings.
 * Use `create(GuildMemberLayoutSettingsSchema)` to create a new message.
 */
export const GuildMemberLayoutSettingsSchema: GenMessage<GuildMemberLayoutSettings> = /*@__PURE__*/
  messageDesc(file_aethernet_user_preferences_v1_preferences, 19);

/**
 * @generated from message aethernet.user.preferences.v1.GuildFolderExpandedState
 */
export type GuildFolderExpandedState = Message<"aethernet.user.preferences.v1.GuildFolderExpandedState"> & {
  /**
   * @generated from field: repeated fixed64 expanded_folder_ids = 1;
   */
  expandedFolderIds: bigint[];
};

/**
 * Describes the message aethernet.user.preferences.v1.GuildFolderExpandedState.
 * Use `create(GuildFolderExpandedStateSchema)` to create a new message.
 */
export const GuildFolderExpandedStateSchema: GenMessage<GuildFolderExpandedState> = /*@__PURE__*/
  messageDesc(file_aethernet_user_preferences_v1_preferences, 20);

/**
 * @generated from message aethernet.user.preferences.v1.HiddenGuildListButtons
 */
export type HiddenGuildListButtons = Message<"aethernet.user.preferences.v1.HiddenGuildListButtons"> & {
  /**
   * @generated from field: bool download_button = 1;
   */
  downloadButton: boolean;

  /**
   * @generated from field: bool help_button = 2;
   */
  helpButton: boolean;
};

/**
 * Describes the message aethernet.user.preferences.v1.HiddenGuildListButtons.
 * Use `create(HiddenGuildListButtonsSchema)` to create a new message.
 */
export const HiddenGuildListButtonsSchema: GenMessage<HiddenGuildListButtons> = /*@__PURE__*/
  messageDesc(file_aethernet_user_preferences_v1_preferences, 21);

/**
 * @generated from message aethernet.user.preferences.v1.KeyboardModeIntroState
 */
export type KeyboardModeIntroState = Message<"aethernet.user.preferences.v1.KeyboardModeIntroState"> & {
  /**
   * @generated from field: bool seen = 1;
   */
  seen: boolean;
};

/**
 * Describes the message aethernet.user.preferences.v1.KeyboardModeIntroState.
 * Use `create(KeyboardModeIntroStateSchema)` to create a new message.
 */
export const KeyboardModeIntroStateSchema: GenMessage<KeyboardModeIntroState> = /*@__PURE__*/
  messageDesc(file_aethernet_user_preferences_v1_preferences, 22);

/**
 * @generated from message aethernet.user.preferences.v1.InputMonitoringPromptsState
 */
export type InputMonitoringPromptsState = Message<"aethernet.user.preferences.v1.InputMonitoringPromptsState"> & {
  /**
   * @generated from field: bool seen_cta = 1;
   */
  seenCta: boolean;
};

/**
 * Describes the message aethernet.user.preferences.v1.InputMonitoringPromptsState.
 * Use `create(InputMonitoringPromptsStateSchema)` to create a new message.
 */
export const InputMonitoringPromptsStateSchema: GenMessage<InputMonitoringPromptsState> = /*@__PURE__*/
  messageDesc(file_aethernet_user_preferences_v1_preferences, 23);

/**
 * @generated from message aethernet.user.preferences.v1.VoicePromptsState
 */
export type VoicePromptsState = Message<"aethernet.user.preferences.v1.VoicePromptsState"> & {
  /**
   * @generated from field: bool skip_hide_own_camera_confirm = 1;
   */
  skipHideOwnCameraConfirm: boolean;

  /**
   * @generated from field: bool skip_hide_own_screenshare_confirm = 2;
   */
  skipHideOwnScreenshareConfirm: boolean;
};

/**
 * Describes the message aethernet.user.preferences.v1.VoicePromptsState.
 * Use `create(VoicePromptsStateSchema)` to create a new message.
 */
export const VoicePromptsStateSchema: GenMessage<VoicePromptsState> = /*@__PURE__*/
  messageDesc(file_aethernet_user_preferences_v1_preferences, 24);

/**
 * @generated from message aethernet.user.preferences.v1.SudoPromptState
 */
export type SudoPromptState = Message<"aethernet.user.preferences.v1.SudoPromptState"> & {
  /**
   * @generated from field: optional aethernet.user.preferences.v1.MfaMethod last_used_mfa_method = 1;
   */
  lastUsedMfaMethod?: MfaMethod | undefined;
};

/**
 * Describes the message aethernet.user.preferences.v1.SudoPromptState.
 * Use `create(SudoPromptStateSchema)` to create a new message.
 */
export const SudoPromptStateSchema: GenMessage<SudoPromptState> = /*@__PURE__*/
  messageDesc(file_aethernet_user_preferences_v1_preferences, 25);

/**
 * @generated from message aethernet.user.preferences.v1.KeybindSettings
 */
export type KeybindSettings = Message<"aethernet.user.preferences.v1.KeybindSettings"> & {
  /**
   * @generated from field: repeated aethernet.user.preferences.v1.CustomKeybind custom_keybinds = 1;
   */
  customKeybinds: CustomKeybind[];

  /**
   * @generated from field: string transmit_mode = 2;
   */
  transmitMode: string;

  /**
   * @generated from field: optional uint32 push_to_talk_release_delay_ms = 3;
   */
  pushToTalkReleaseDelayMs?: number | undefined;
};

/**
 * Describes the message aethernet.user.preferences.v1.KeybindSettings.
 * Use `create(KeybindSettingsSchema)` to create a new message.
 */
export const KeybindSettingsSchema: GenMessage<KeybindSettings> = /*@__PURE__*/
  messageDesc(file_aethernet_user_preferences_v1_preferences, 26);

/**
 * @generated from message aethernet.user.preferences.v1.CustomKeybind
 */
export type CustomKeybind = Message<"aethernet.user.preferences.v1.CustomKeybind"> & {
  /**
   * @generated from field: string id = 1;
   */
  id: string;

  /**
   * @generated from field: optional string action = 2;
   */
  action?: string | undefined;

  /**
   * @generated from field: aethernet.user.preferences.v1.KeybindCombo combo = 3;
   */
  combo?: KeybindCombo | undefined;

  /**
   * @generated from field: bool enabled = 4;
   */
  enabled: boolean;
};

/**
 * Describes the message aethernet.user.preferences.v1.CustomKeybind.
 * Use `create(CustomKeybindSchema)` to create a new message.
 */
export const CustomKeybindSchema: GenMessage<CustomKeybind> = /*@__PURE__*/
  messageDesc(file_aethernet_user_preferences_v1_preferences, 27);

/**
 * @generated from message aethernet.user.preferences.v1.KeybindCombo
 */
export type KeybindCombo = Message<"aethernet.user.preferences.v1.KeybindCombo"> & {
  /**
   * @generated from field: string key = 1;
   */
  key: string;

  /**
   * @generated from field: optional string code = 2;
   */
  code?: string | undefined;

  /**
   * @generated from field: bool ctrl_or_meta = 3;
   */
  ctrlOrMeta: boolean;

  /**
   * @generated from field: bool ctrl = 4;
   */
  ctrl: boolean;

  /**
   * @generated from field: bool alt = 5;
   */
  alt: boolean;

  /**
   * @generated from field: bool shift = 6;
   */
  shift: boolean;

  /**
   * @generated from field: bool meta = 7;
   */
  meta: boolean;

  /**
   * @generated from field: optional bool global = 8;
   */
  global?: boolean | undefined;

  /**
   * @generated from field: optional bool enabled = 9;
   */
  enabled?: boolean | undefined;

  /**
   * @generated from field: bool modifier_only = 10;
   */
  modifierOnly: boolean;

  /**
   * @generated from field: bool both_sides = 11;
   */
  bothSides: boolean;

  /**
   * @generated from field: optional uint32 mouse_button = 12;
   */
  mouseButton?: number | undefined;

  /**
   * @generated from field: optional uint32 gamepad_button = 13;
   */
  gamepadButton?: number | undefined;
};

/**
 * Describes the message aethernet.user.preferences.v1.KeybindCombo.
 * Use `create(KeybindComboSchema)` to create a new message.
 */
export const KeybindComboSchema: GenMessage<KeybindCombo> = /*@__PURE__*/
  messageDesc(file_aethernet_user_preferences_v1_preferences, 28);

/**
 * @generated from message aethernet.user.preferences.v1.ChatInputSettings
 */
export type ChatInputSettings = Message<"aethernet.user.preferences.v1.ChatInputSettings"> & {
  /**
   * @generated from field: optional bool convert_emoticons = 1;
   */
  convertEmoticons?: boolean | undefined;
};

/**
 * Describes the message aethernet.user.preferences.v1.ChatInputSettings.
 * Use `create(ChatInputSettingsSchema)` to create a new message.
 */
export const ChatInputSettingsSchema: GenMessage<ChatInputSettings> = /*@__PURE__*/
  messageDesc(file_aethernet_user_preferences_v1_preferences, 29);

/**
 * @generated from enum aethernet.user.preferences.v1.PermissionLayoutMode
 */
export enum PermissionLayoutMode {
  /**
   * @generated from enum value: PERMISSION_LAYOUT_MODE_UNSPECIFIED = 0;
   */
  UNSPECIFIED = 0,

  /**
   * @generated from enum value: PERMISSION_LAYOUT_MODE_COMFY = 1;
   */
  COMFY = 1,

  /**
   * @generated from enum value: PERMISSION_LAYOUT_MODE_DENSE = 2;
   */
  DENSE = 2,
}

/**
 * Describes the enum aethernet.user.preferences.v1.PermissionLayoutMode.
 */
export const PermissionLayoutModeSchema: GenEnum<PermissionLayoutMode> = /*@__PURE__*/
  enumDesc(file_aethernet_user_preferences_v1_preferences, 0);

/**
 * @generated from enum aethernet.user.preferences.v1.PermissionGridMode
 */
export enum PermissionGridMode {
  /**
   * @generated from enum value: PERMISSION_GRID_MODE_UNSPECIFIED = 0;
   */
  UNSPECIFIED = 0,

  /**
   * @generated from enum value: PERMISSION_GRID_MODE_SINGLE = 1;
   */
  SINGLE = 1,

  /**
   * @generated from enum value: PERMISSION_GRID_MODE_GRID = 2;
   */
  GRID = 2,
}

/**
 * Describes the enum aethernet.user.preferences.v1.PermissionGridMode.
 */
export const PermissionGridModeSchema: GenEnum<PermissionGridMode> = /*@__PURE__*/
  enumDesc(file_aethernet_user_preferences_v1_preferences, 1);

/**
 * @generated from enum aethernet.user.preferences.v1.GuildMemberViewMode
 */
export enum GuildMemberViewMode {
  /**
   * @generated from enum value: GUILD_MEMBER_VIEW_MODE_UNSPECIFIED = 0;
   */
  UNSPECIFIED = 0,

  /**
   * @generated from enum value: GUILD_MEMBER_VIEW_MODE_TABLE = 1;
   */
  TABLE = 1,

  /**
   * @generated from enum value: GUILD_MEMBER_VIEW_MODE_GRID = 2;
   */
  GRID = 2,
}

/**
 * Describes the enum aethernet.user.preferences.v1.GuildMemberViewMode.
 */
export const GuildMemberViewModeSchema: GenEnum<GuildMemberViewMode> = /*@__PURE__*/
  enumDesc(file_aethernet_user_preferences_v1_preferences, 2);

/**
 * @generated from enum aethernet.user.preferences.v1.MfaMethod
 */
export enum MfaMethod {
  /**
   * @generated from enum value: MFA_METHOD_UNSPECIFIED = 0;
   */
  UNSPECIFIED = 0,

  /**
   * @generated from enum value: MFA_METHOD_TOTP = 1;
   */
  TOTP = 1,

  /**
   * @generated from enum value: MFA_METHOD_WEBAUTHN = 3;
   */
  WEBAUTHN = 3,
}

/**
 * Describes the enum aethernet.user.preferences.v1.MfaMethod.
 */
export const MfaMethodSchema: GenEnum<MfaMethod> = /*@__PURE__*/
  enumDesc(file_aethernet_user_preferences_v1_preferences, 3);
