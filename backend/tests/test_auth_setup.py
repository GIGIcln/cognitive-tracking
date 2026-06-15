import threading

VALID_BODY = {
    "email": "admin@test.com",
    "password": "Admin123",
    "full_name": "Admin User",
}


def test_setup_first_call_returns_201(client):
    res = client.post("/api/auth/setup", json=VALID_BODY)
    assert res.status_code == 201
    data = res.json()
    assert "message" in data
    assert "user" in data
    assert data["user"]["email"] == "admin@test.com"


def test_setup_second_call_returns_400(client):
    client.post("/api/auth/setup", json=VALID_BODY)
    res = client.post("/api/auth/setup", json={
        "email": "other@test.com",
        "password": "Admin123",
        "full_name": "Other User",
    })
    assert res.status_code == 400
    assert "già completato" in res.json()["detail"]


def test_setup_race_condition_no_500(client):
    results = []
    lock = threading.Lock()

    def make_request():
        res = client.post("/api/auth/setup", json=VALID_BODY)
        with lock:
            results.append(res.status_code)

    t1 = threading.Thread(target=make_request)
    t2 = threading.Thread(target=make_request)
    t1.start()
    t2.start()
    t1.join()
    t2.join()

    assert 500 not in results
    assert 201 in results
    assert 400 in results


def test_setup_weak_password_returns_422(client):
    res = client.post("/api/auth/setup", json={
        "email": "admin@test.com",
        "password": "123",
        "full_name": "Admin User",
    })
    assert res.status_code == 422
