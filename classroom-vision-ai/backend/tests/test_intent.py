from app.intent import parse_local


def test_heart_command():
    result = parse_local('Show the human heart and blood flow')
    assert result.visualId == 'heart'
    assert result.action == 'show'
    assert result.confidence > 0.7


def test_osi_command():
    result = parse_local('Please open the OSI model seven layers')
    assert result.visualId == 'osi'
    assert result.action == 'show'


def test_zoom_action():
    result = parse_local('zoom in')
    assert result.action == 'zoom-in'
