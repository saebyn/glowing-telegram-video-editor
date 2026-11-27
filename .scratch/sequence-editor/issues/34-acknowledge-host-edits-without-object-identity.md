# 34 — Decide whether the editor needs explicit edit acknowledgement

Resolution: Superseded by [session-owned working sequences](../../../docs/adr/0002-own-the-working-sequence-in-the-editor.md). [#111](111-own-the-working-sequence-and-history.md) removes host acknowledgement rather than adding another form of it.

Today the host must feed back the exact proposed sequence object to
preserve Undo history. A host that confirms an edit asynchronously and
returns a deserialized sequence cannot distinguish that confirmation from
an independent replacement using the current interface.

## Open question

Does a host need a way to tell the editor “this is the same edit you
proposed” when it feeds back a new object, or is the existing controlled
contract sufficient in practice? Confirm a host workflow before proposing
a new API.

Keeping an edit in the current working sequence is not the same as saving
it. The editor may need the former to maintain Undo history. The
recommendation is to leave saved/dirty state, errors, retries, and status
UI to the host even if explicit edit acknowledgement proves useful.

## Comments

- Inspired by the [failed-save report in Streamosaic #219](https://github.com/saebyn/streamosaic/issues/219#issuecomment-6939646605),
  not a claimed reproduction in this library. Build on
  [09](09-undo-the-last-edit.md) and [22](22-redo-an-undone-edit.md).
  In that example, establish what the host wants to do on a failed save:
  keep an unsaved working sequence or replace it with the last saved one.
  That choice belongs to the host, not the history mechanism.
- Triage: no saved/dirty state or save errors in the editor. Revisit this
  API only when a host needs to acknowledge an accepted working edit with
  a different object and preserve Undo history.
