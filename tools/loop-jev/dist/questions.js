/** Typed TypeSafe System One question builders. */
export function noul(instructions, criteria) {
    return criteria ? { type: 'noul', instructions, criteria } : { type: 'noul', instructions };
}
export function choice(instructions, criteria) {
    return { type: 'choice', instructions, criteria };
}
export function score(instructions, criteria) {
    return { type: 'score', instructions, criteria };
}
export function asNoul(answer, fallback = 0) {
    return answer && answer.type === 'noul' ? answer.noul : fallback;
}
export function asChoice(answer) {
    return answer && answer.type === 'choice' ? answer : undefined;
}
export function asScore(answer, fallback = 0) {
    return answer && answer.type === 'score' ? answer.score : fallback;
}
