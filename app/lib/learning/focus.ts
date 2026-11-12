export type LearningFocus='guided'|'speaking'
export type FocusPreference={status:'known';focus:LearningFocus|null}|{status:'unavailable';focus:null}
export function isLearningFocus(value:unknown):value is LearningFocus {return value==='guided'||value==='speaking'}
export type SpeakingAvailability=
  | {status:'available';dailyRemaining:number|null;monthlyRemaining:number|null;checkedAt:string}
  | {status:'exhausted';resetsAt:string;checkedAt:string}
  | {status:'unavailable';checkedAt:string}
