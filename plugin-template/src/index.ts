import { ReboostPlugin } from 'reboost';

interface Options {

}

export = (options: Options = {}): ReboostPlugin => {
  return {
    name: '{{ name }}-plugin'
  }
}
