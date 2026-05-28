const CHALLENGES = ['smile'];

export function generateChallenge() {
  const idx = Math.floor(Math.random() * CHALLENGES.length);
  return CHALLENGES[idx];
}

export function challengeLabel(challenge) {
  if (challenge === 'smile') {
    return 'Please smile clearly, then capture.';
  }
  return 'Perform liveness action.';
}
