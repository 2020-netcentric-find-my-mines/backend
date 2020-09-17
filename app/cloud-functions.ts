import axios from 'axios'
import { Player } from './types/player.interface'

const CLOUD_FUNCTIONS = ''

export const incrementUserScore = async (player: Player) => {
    try {
        if (player.account) {
            await axios.post(CLOUD_FUNCTIONS + '/incrementUserScore', { uid: player.account })
        }
    } catch (e) {
        console.warn('[cloud-functions] Cannot perform `incrementUserScore` for player', player)
    }
}