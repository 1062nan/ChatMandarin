import {it,expect} from 'vitest'
import {ttsErrorMessage} from './tts-error'
it('explains caps and avoids arbitrary server details',()=>{expect(ttsErrorMessage({code:'daily_limit'})).toContain('00:00 UTC');expect(ttsErrorMessage({code:'rate_limit'})).toContain('20 requests');expect(ttsErrorMessage({code:'secret'})).not.toContain('secret')})
