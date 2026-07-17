from models.schemas import UserLogin
from routers.auth import DEMO_EMAIL, DEMO_PASSWORD, is_demo_login


def test_demo_credentials_are_recognized_case_insensitively():
    credentials = UserLogin(email=DEMO_EMAIL.upper(), password=DEMO_PASSWORD)

    assert is_demo_login(credentials)
