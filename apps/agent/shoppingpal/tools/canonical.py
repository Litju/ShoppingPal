from __future__ import annotations

from shoppingpal.schemas import Candidate


def candidate_revision(candidate: Candidate) -> str:
    """Revision is derived from canonical Medusa state, never from discovery text."""
    return f"{candidate.variant_id}:{candidate.price}:{candidate.stock}:{candidate.currency}"
