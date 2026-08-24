from shoppingpal.ranking.deterministic import rank_candidates
from shoppingpal.schemas import Preference
from tests.test_graph import product


def test_mission_preferences_change_deterministic_ranking() -> None:
    commute = product("prod_commute")
    studio = product("prod_studio").model_copy(update={"specs": {"Use": "studio"}, "rating_tenths": 50})

    ranked = rank_candidates(
        "headphones",
        [studio, commute],
        preferences=[Preference(key="use", value="commute")],
    )

    assert ranked[0].candidate.product_id == "prod_commute"
    assert "matches mission preferences" in ranked[0].reasons
