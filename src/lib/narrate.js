// Turns a search trace into human-readable steps for the 3-D walkthrough.
const fmt = (d) => Math.round(d);
const plural = (k, word) => `${k} ${word}${k === 1 ? '' : 's'}`;

function insort(arr, item) {
    let lo = 0, hi = arr.length;
    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (arr[mid][0] < item[0]) lo = mid + 1;
        else hi = mid;
    }
    arr.splice(lo, 0, item);
}

export function buildSteps(trace, ef) {
    const groups = [];
    for (const ev of trace) {
        const g = groups[groups.length - 1];
        if (!g || g.layer !== ev.layer) groups.push({ layer: ev.layer, events: [ev] });
        else g.events.push(ev);
    }
    const top = groups.length ? groups[0].layer : 0;
    const steps = [];

    for (const g of groups) {
        const L = g.layer;
        const efL = L > 0 ? 1 : Math.max(ef, 1);
        const results = [];
        const dist = new Map();
        const keep = (d, id) => {
            if (results.length < efL || d < results[results.length - 1][0]) {
                insort(results, [d, id]);
                if (results.length > efL) results.pop();
                return true;
            }
            return false;
        };
        let pending = [];
        let intro = '';
        let cur = null;
        const layerSteps = [];

        const finish = (step, isLast, isFirst) => {
            const k = step.visits.length;
            const here = dist.get(step.node);
            let text;
            if (efL === 1) {
                text = `Standing on a point ${fmt(here)} away from the query. `;
                if (k === 0 && isFirst) text += 'It has no neighbours on this layer, so there’s nowhere to go.';
                else if (k === 0) text += 'Its neighbours here were all measured already.';
                else {
                    const dmin = Math.min(...step.visits.map((v) => v.d));
                    text += dmin < step.before
                        ? `Measure its ${plural(k, 'new neighbour')} on this layer. The closest is ${fmt(dmin)} away, which beats ${fmt(step.before)}, so hop there.`
                        : `Measure its ${plural(k, 'new neighbour')} on this layer. None of them beats ${fmt(step.before)}.`;
                }
                if (isLast) {
                    text += L > 0
                        ? ` This is as close as layer ${L} can get, so carry this point down to layer ${L - 1}.`
                        : ' No neighbour is closer, so this point is the answer.';
                }
            } else {
                text = `Explore the closest unexplored candidate (${fmt(here)} away). It has ${plural(k, 'new neighbour')}; ${step.admitted} entered the best-${efL} list. `
                    + `Best ${efL} so far: ${step.snapshot.map(fmt).join(', ')}.`;
                if (isLast) {
                    const worst = step.snapshot[step.snapshot.length - 1];
                    text += ` Every remaining candidate is further than the worst of these (${fmt(worst)}), so exploring more can’t help. Stop: the nearest point found is ${fmt(step.snapshot[0])} away.`;
                }
            }
            step.text = step.intro + text;
        };

        for (const ev of g.events) {
            if (ev.type === 'visit' && ev.from === null) {
                dist.set(ev.id, ev.d);
                keep(ev.d, ev.id);
                pending.push(ev);
                intro = L === top
                    ? `Layer ${L}, the top: start at the entry point. `
                    : `Layer ${L}: drop down, starting from the point carried over from above. `;
            } else if (ev.type === 'expand') {
                if (cur) cur.snapshot = results.map((r) => r[0]);
                cur = { layer: L, node: ev.id, events: [...pending, ev], visits: [], admitted: 0, before: results[0][0], intro };
                pending = [];
                intro = '';
                layerSteps.push(cur);
            } else {
                dist.set(ev.id, ev.d);
                cur.events.push(ev);
                cur.visits.push(ev);
                if (keep(ev.d, ev.id)) cur.admitted++;
            }
        }
        if (cur) cur.snapshot = results.map((r) => r[0]);
        layerSteps.forEach((s, i) => finish(s, i === layerSteps.length - 1, i === 0));
        steps.push(...layerSteps);
    }
    return steps;
}