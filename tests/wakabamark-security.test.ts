import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { WakabamarkEngine } from '../src/index.ts';

describe('WakabamarkEngine security and edge cases', () => {
	it('preserves list continuation lines safely', () => {
		const engine = new WakabamarkEngine();
		const input = ['* first line', '  second line'].join('\n');

		assert.equal(
			engine.renderHtml(input),
			'<ul><li>first line<br />second line</li></ul>',
		);
		assert.equal(engine.renderMarkdown(input), ['- first line', '  second line'].join('\n'));
	});

	it('supports code spans with variable backtick fences', () => {
		const engine = new WakabamarkEngine();

		assert.equal(
			engine.renderHtml('Use ``a`b`` here.'),
			'<p>Use <code>a`b</code> here.</p>',
		);
		assert.equal(engine.renderMarkdown('Use ``a`b`` here.'), 'Use ``a`b`` here.');
	});

	it('never decodes HTML entities into executable markup', () => {
		const engine = new WakabamarkEngine();
		const input = '&lt;img src=x onerror=alert(1)&gt;';

		assert.equal(
			engine.renderHtml(input),
			'<p>&amp;lt;img src=x onerror=alert(1)&amp;gt;</p>',
		);
		assert.equal(engine.renderMarkdown(input), input);
	});
});
