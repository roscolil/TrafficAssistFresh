import EventEmitter from 'eventemitter3';
import {estimateDistanceMeters, Detection} from '../ai/utils';
import {nearestSignalAhead} from '../map/intersectionPack';
import {cloudConfirmClient} from '../cloud/CloudConfirmClient';
import {flags} from '../config/flags';

type Cue = {text: string; priority: 'low' | 'medium' | 'high'};

const bus = new EventEmitter();
let lastSpokenTs = 0;
let lastCueText = '';

export function useEarlyWarning() {
  function ingest({
    detections,
    heading,
    location,
    ts,
  }: {
    detections: Detection[];
    heading?: number;
    location?: any;
    ts: number;
  }) {
    const ahead = nearestSignalAhead(location, heading, 220);
    const lights = (detections || []).filter(d => d.cls === 'traffic_light');
    if (!lights.length) return;

    const best = lights.sort((a, b) => b.conf - a.conf)[0];
    const dist = estimateDistanceMeters(best.bbox);
    if (!dist || !ahead) maybeAskCloud(best, location, heading);

    const now = Date.now();
    const withinBand =
      best.conf >= flags.lowConfBand[0] && best.conf < flags.lowConfBand[1];
    if (withinBand) {
      maybeAskCloud(best, location, heading);
    }

    const cue = decideCue(best, dist);
    if (!cue) return;

    if (cue.text !== lastCueText || now - lastSpokenTs > 3000) {
      lastSpokenTs = now;
      lastCueText = cue.text;
      bus.emit('cue', cue);
    }
  }

  cloudConfirmClient.onResponse(resp => {
    console.log('cloud confirm resp', resp);
  });

  return {
    ingest,
    onCue: (fn: (c: Cue) => void) => {
      bus.addListener('cue', fn);
      return {remove: () => bus.removeListener('cue', fn)};
    },
  };
}

function decideCue(best: Detection, dist: number | null): Cue | null {
  if (!dist) return null;
  if (best.state === 'red') {
    if (dist < 60)
      return {text: 'Red light ahead, 60 meters', priority: 'high'};
    if (dist < 120)
      return {text: 'Red light ahead, 120 meters', priority: 'medium'};
  } else if (best.state === 'green') {
    if (dist < 120) return {text: 'Green light ahead', priority: 'low'};
  } else if (best.state === 'amber') {
    if (dist < 90) return {text: 'Amber light ahead', priority: 'medium'};
  }
  return null;
}

function maybeAskCloud(best: Detection, location?: any, heading?: number) {
  if (!flags.cloudConfirmEnabled) return;
  const [minBand, maxBand] = flags.lowConfBand;
  if (best.conf >= minBand && best.conf < maxBand) {
    const id = `${Math.round(best.bbox[0] * 1000)}-${Date.now() % 100000}`;
    cloudConfirmClient.enqueue({
      id,
      cls: best.cls,
      bbox: best.bbox,
      conf: best.conf,
      state: best.state,
      location,
      heading,
    });
  }
}
