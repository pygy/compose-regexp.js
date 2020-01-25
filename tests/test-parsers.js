import {default as o} from 'ospec'
import {hasTopLevelChoice} from '../src/_parsers.js'


o.spec('parsers', function(){
  o('hasTopLevelChoice', function(){
    o(hasTopLevelChoice('ab')).equals(false)
    o(hasTopLevelChoice('[a]b')).equals(false)
    o(hasTopLevelChoice('[a|b]')).equals(false)
    o(hasTopLevelChoice('(a|b)')).equals(false)
    o(hasTopLevelChoice('a|b')).equals(true)
    o(hasTopLevelChoice('[a]|b')).equals(true)
    o(hasTopLevelChoice('[ada|odo]')).equals(false)
    o(hasTopLevelChoice('[^ada|odo]')).equals(false)
  })
})
