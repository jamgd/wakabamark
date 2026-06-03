import { WakabamarkEngine } from '../src/index.ts';

(() => {
  const wakabamarkEngine = new WakabamarkEngine({
    features: {
      spoilers: true,
      postReferences: true,
    },
    html: {
      blockquoteClassName: 'greentext',
      spoilerClassName: 'spoiler',
    },
  });

  const input = document.querySelector('#input');
  const output = document.querySelector('.output');

  input?.addEventListener('input', event => {
    const value =
      event.target && 'value' in event.target && typeof event.target.value === 'string' ? event.target.value : '';
    output?.setHTMLUnsafe(wakabamarkEngine.renderHtml(value));
  });

  input?.dispatchEvent(new Event('input'));
})();
