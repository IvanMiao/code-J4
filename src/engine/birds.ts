export type BirdReaction = 'none' | 'alert' | 'hop_away' | 'flush' | 'curious';

export type SpeciesParams = {
  catRadius: number;
  runRadius: number;
  panicRadius: number;
  walkRadius: number;
};

export const SPARROW_PARAMS: SpeciesParams = {
  catRadius: 150,
  runRadius: 190,
  panicRadius: 55,
  walkRadius: 110,
};

export function birdReaction(s: {
  distance: number;
  playerSpeed: number;
  stillFor: number;
  catDistance: number;
  bold: boolean;
  alertFor: number;
  species: SpeciesParams;
}): BirdReaction {
  if (s.catDistance < s.species.catRadius) return 'flush';
  if (s.playerSpeed > 330 && s.distance < s.species.runRadius) return 'flush';
  if (s.distance < s.species.panicRadius) return 'flush';
  if (s.playerSpeed > 0 && s.distance < s.species.walkRadius) {
    return s.alertFor < 350 ? 'alert' : 'hop_away';
  }
  if (s.stillFor > 2000 && s.bold && s.distance > 70 && s.distance < 170) return 'curious';
  return 'none';
}
