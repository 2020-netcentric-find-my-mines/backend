export enum SocketEvent {
    CONNECTION = 'connection',
    DISCONNECT = 'disconnect',

    // Server events: [Server] -> [Client]
    TICK = 'TICK',
    NEXT_PLAYER = 'NEXT_PLAYER',
    COORDINATED_SELECTED = 'COORDINATED_SELECTED',
    WINNER = 'WINNER',
    GAME_STATE_CHANGED = 'GAME_STATE_CHANGED',
    CURRENT_PLAYER = 'CURRENT_PLAYER',
    MEMBER_JOINED_GAME = 'MEMBER_JOINED_GAME',
    MEMBER_LEFT_GAME = 'MEMBER_LEFT_GAME',
    MEMBER_CHANGED_TYPE = 'MEMBER_CHANGED_TYPE',

    // Client feedbacks: [Server] -> [Client]
    SELECT_COORDINATE_FEEDBACK = 'SELECT_COORDINATE_FEEDBACK',
    CREATE_GAME_FEEDBACK = 'CREATE_GAME_FEEDBACK',
    JOIN_GAME_FEEDBACK = 'JOIN_GAME_FEEDBACK',
    LEAVE_GAME_FEEDBACK = 'LEAVE_GAME_FEEDBACK',
    QUICK_MATCH_FEEDBACK = 'QUICK_MATCH_FEEDBACK',
    START_GAME_FEEDBACK = 'START_GAME_FEEDBACK',
    PLAY_AGAIN_FEEDBACK = 'PLAY_AGAIN_FEEDBACK',
    RESET_BOARD_FEEDBACK = 'RESET_BOARD_FEEDBACK',
    SET_BOARD_SIZE_FEEDBACK = 'SET_BOARD_SIZE_FEEDBACK',
    PAUSE_FEEDBACK = 'PAUSE_FEEDBACK',
    CHANGE_PLAYER_TYPE_FEEDBACK = 'CHANGE_PLAYER_TYPE_FEEDBACK',
    SET_NUMBER_OF_BOMB_FEEDBACK = 'SET_NUMBER_OF_BOMB_FEEDBACK',
    SET_MAX_PLAYER_FEEDBACK = 'SET_MAX_PLAYER_FEEDBACK',
    GET_CURRENT_PLAYER_FEEDBACK = 'GET_CURRENT_PLAYER_FEEDBACK',
    SET_PLAYER_NAME_FEEDBACK = 'SET_PLAYER_NAME_FEEDBACK',

    // Client events: [Client] -> [Server]
    SELECT_COORDINATE = 'SELECT_COORDINATE',
    CREATE_GAME = 'CREATE_GAME',
    JOIN_GAME = 'JOIN_GAME',
    LEAVE_GAME = 'LEAVE_GAME',
    QUICK_MATCH = 'QUICK_MATCH',
    START_GAME = 'START_GAME',
    PLAY_AGAIN = 'PLAY_AGAIN',
    RESET_BOARD = 'RESET_BOARD',
    SET_BOARD_SIZE = 'SET_BOARD_SIZE',
    PAUSE = 'PAUSE',
    CHANGE_PLAYER_TYPE = 'CHANGE_PLAYER_TYPE',
    SET_NUMBER_OF_BOMB = 'SET_NUMBER_OF_BOMB',
    SET_MAX_PLAYER = 'SET_MAX_PLAYER',
    GET_CURRENT_PLAYER = 'GET_CURRENT_PLAYER',
    SET_PLAYER_NAME = 'SET_PLAYER_NAME',
}
