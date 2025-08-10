import { AudioChannel } from "@/types";

export function hasAudioChanges(channels: AudioChannel[]): boolean {
  return channels.some((channel) => channel.level !== 1.0 || channel.muted);
}

export function isAllMuted(channels: AudioChannel[]): boolean {
  return channels.every((channel) => channel.muted);
}
