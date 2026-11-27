# Own the working sequence in the editor

The editing session owns the working sequence and Undo/Redo history. A React
remount opens `initialSequence`; ordinary rerenders do not replace it.
Optional edit notifications report committed snapshots. The host owns
persistence, but neither a save result nor a host acknowledgement changes
the working sequence.

We chose this over a controlled sequence prop so that edits and history
advance without waiting for a host round trip. The trade-off is that a host
cannot replace or veto an edit in the running session: it must deliberately
reopen to load another snapshot. Clips and sources remain host-owned; history
does not restore them. See the [sequence editor design](../sequence-editor-design.md#model-and-ownership)
for the full contract.
