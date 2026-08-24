from __future__ import annotations

from collections.abc import Sequence

from shoppingpal.schemas import Candidate, Preference, RankedCandidate


def rank_candidates(
    query: str,
    candidates: list[Candidate],
    preferences: Sequence[Preference] = (),
) -> list[RankedCandidate]:
    terms = {term.casefold() for term in query.split() if len(term) > 2}
    ranked: list[RankedCandidate] = []
    for candidate in candidates:
        haystack = " ".join(
            (
                candidate.title,
                candidate.brand,
                candidate.category,
                candidate.description,
                *candidate.tags,
                *candidate.specs.keys(),
                *candidate.specs.values(),
            ),
        ).casefold()
        matches = sum(1 for term in terms if term in haystack)
        preference_matches = sum(1 for preference in preferences if preference.value.casefold() in haystack)
        score = (
            matches * 10
            + preference_matches * 5
            + candidate.rating_tenths / 10
            + min(candidate.review_count, 1000) / 1000
        )
        reasons = ["matches current request" if matches else "highest canonical rating"]
        if preference_matches:
            reasons.append("matches mission preferences")
        ranked.append(
            RankedCandidate(
                candidate=candidate,
                score=score,
                reasons=reasons,
            ),
        )
    return sorted(ranked, key=lambda item: (-item.score, item.candidate.price, item.candidate.product_id))
