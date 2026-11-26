# Derive sequence duration from placements

The latest exclusive placement end determines sequence duration; a sequence
without placements has zero duration. We chose this over a separately authored
endpoint, whether exposed as a toolbar setting or a timeline marker, because this
editor does not need independent control of the output length and should not
leave a blank tail when the last placement moves or is removed. Leading and
internal gaps remain possible; a trailing gap with no placement cannot
independently extend the output.
