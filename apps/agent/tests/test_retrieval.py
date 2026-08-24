from shoppingpal.retrieval.medusa import _matches_query
from tests.test_graph import product


def test_typesense_hydration_keeps_canonical_query_relevance() -> None:
    candidate = product()

    assert _matches_query(candidate, "headphones") is True
    assert _matches_query(candidate, "cooler") is False
    assert _matches_query(candidate, "") is True
