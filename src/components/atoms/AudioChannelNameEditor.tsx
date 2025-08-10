import { useEffect, useRef, useState } from "react";

interface AudioChannelNameEditorProps {
  /**
   * Current name of the audio channel
   */
  name: string;
  /**
   * Callback when name changes
   */
  onNameChange: (name: string) => void;
  /**
   * Whether the editor is disabled
   */
  disabled?: boolean;
  /**
   * Placeholder text when name is empty
   */
  placeholder?: string;
  /**
   * Maximum length for channel name
   */
  maxLength?: number;
}

export default function AudioChannelNameEditor({
  name,
  onNameChange,
  disabled = false,
  placeholder = "Channel Name",
  maxLength = 50,
}: AudioChannelNameEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editingName, setEditingName] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditingName(name);
  }, [name]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEdit = () => {
    if (!disabled) {
      setIsEditing(true);
      setEditingName(name);
    }
  };

  const handleSave = () => {
    const trimmedName = editingName.trim();
    if (trimmedName && trimmedName !== name) {
      onNameChange(trimmedName);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditingName(name);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
    }
  };

  const handleBlur = () => {
    handleSave();
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={editingName}
        onChange={(e) => setEditingName(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        maxLength={maxLength}
        placeholder={placeholder}
        className="text-sm font-medium bg-white dark:bg-gray-800 border border-blue-500 dark:border-blue-400 rounded px-2 py-1 text-gray-900 dark:text-white min-w-0 w-full focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
        aria-label="Edit channel name"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={handleStartEdit}
      disabled={disabled}
      className={`text-sm font-medium text-left min-w-0 w-full rounded px-2 py-1 ${
        disabled
          ? "text-gray-500 dark:text-gray-400 cursor-not-allowed"
          : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 cursor-text"
      }`}
      title={disabled ? "Cannot edit channel name" : "Click to edit channel name"}
      aria-label="Channel name (click to edit)"
    >
      {name || placeholder}
    </button>
  );
}