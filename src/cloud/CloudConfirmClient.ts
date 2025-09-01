/**
 * CloudConfirmClient — calls your Cloud Run /confirm endpoint (non-blocking).
 * Using: https://cloud-confirm-190217655466.europe-west1.run.app
 */
import EventEmitter from 'eventemitter3';
import {flags} from '../config/flags';

export type ConfirmRequest = {
  id: string;
  cls: string;
  bbox: [number, number, number, number];
  conf: number;
  state?: 'red' | 'amber' | 'green' | 'arrow';
  location?: {lat: number; lon: number};
  heading?: number;
};
export type ConfirmResponse = {
  id: string;
  cls: string;
  state?: 'red' | 'amber' | 'green' | 'arrow';
  conf: number;
  accepted: boolean;
};

class CloudConfirmClient {
  private bus = new EventEmitter();
  private lastSentTs: number[] = [];

  onResponse(cb: (res: ConfirmResponse) => void) {
    this.bus.addListener('resp', cb);
    return () => this.bus.removeListener('resp', cb);
  }

  enqueue(req: ConfirmRequest) {
    if (!flags.cloudConfirmEnabled || !flags.confirmApiUrl) return;
    const now = Date.now();
    this.lastSentTs = this.lastSentTs.filter(t => now - t < 60000);
    if (this.lastSentTs.length >= flags.maxCloudCropsPerMinute) return;

    this.lastSentTs.push(now);
    // Fire-and-forget; do NOT block local cue decisions.
    this.send(req)
      .then(r => {
        this.bus.emit('resp', r);
      })
      .catch(() => {
        // Silently ignore network errors; edge remains authoritative.
      });
  }

  private async send(req: ConfirmRequest): Promise<ConfirmResponse> {
    const API_URL = flags.confirmApiUrl!.replace(/\/$/, '') + '/confirm';
    const r = await fetch(API_URL, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(req),
    });
    if (!r.ok) throw new Error('confirm http ' + r.status);
    return (await r.json()) as ConfirmResponse;
  }
}

export const cloudConfirmClient = new CloudConfirmClient();
