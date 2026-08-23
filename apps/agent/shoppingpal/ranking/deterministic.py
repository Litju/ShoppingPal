from __future__ import annotations

from shoppingpal.schemas import Candidate, RankedCandidate


def rank_candidates(query: str, candidates: list[Candidate]) -> list[RankedCandidate]:
    terms = {term.casefold() for term in query.split() if len(term) > 2}
    ranked: list[RankedCandidate] = []
    for candidate in candidates:
        haystack = " ".join((candidate.title, candidate.brand, candidate.description, *candidate.tags)).casefold()
        matches = sum(1 for term in terms if term in haystack)
        score = matches * 10 + candidate.rating_tenths / 10 + min(candidate.review_count, 1000) / 1000
        ranked.append(
            RankedCandidate(
                candidate=candidate,
                score=score,
                reasons=["matches current request" if matches else "highest canonical rating"],
            ),
        )
    return sorted(ranked, key=lambda item: (-item.score, item.candidate.price, item.candidate.product_id))
