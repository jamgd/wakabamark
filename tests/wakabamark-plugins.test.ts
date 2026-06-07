import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { WakabamarkEngine, type WakabamarkEnginePlugin } from '../src/index.ts';

describe('WakabamarkEngine plugins', () => {
  it('supports inline plugins that emit built-in safe nodes', () => {
    const mentionPlugin: WakabamarkEnginePlugin = {
      name: 'mentions',
      parseInline: ({ input, start }) => {
        const match = /^@([a-z0-9_]+)/i.exec(input.slice(start));
        const username = match?.[1];
        if (!match || username === undefined) {
          return null;
        }

        return {
          nodes: [
            {
              type: 'link',
              href: `/users/${username}`,
              text: `@${username}`,
              external: false,
            },
          ],
          nextIndex: start + match[0].length,
        };
      },
    };

    const engine = new WakabamarkEngine({
      plugins: [mentionPlugin],
    });

    assert.equal(engine.renderHtml('Hello @alice.'), '<p>Hello <a href="/users/alice">@alice</a>.</p>');
    assert.equal(engine.renderMarkdown('Hello @alice.'), 'Hello [@alice](/users/alice).');
    assert.equal(engine.extractPlainText('Hello @alice.'), 'Hello @alice.');
  });

  it('allows plugins to emit nested built-in inline containers', () => {
    const styledPlugin: WakabamarkEnginePlugin = {
      name: 'styled',
      parseInline: ({ input, start }) => {
        if (!input.startsWith(':sparkle:', start)) {
          return null;
        }

        return {
          nodes: [
            {
              type: 'strong',
              children: [
                {
                  type: 'emphasis',
                  children: [{ type: 'text', value: 'shine' }],
                },
              ],
            },
          ],
          nextIndex: start + ':sparkle:'.length,
        };
      },
    };

    const engine = new WakabamarkEngine({
      plugins: [styledPlugin],
    });

    assert.equal(engine.renderHtml(':sparkle:'), '<p><strong><em>shine</em></strong></p>');
    assert.equal(engine.renderMarkdown(':sparkle:'), '***shine***');
  });

  it('prefers higher-priority plugins when multiple plugins match the same input', () => {
    const lowPriorityPlugin: WakabamarkEnginePlugin = {
      name: 'low-priority',
      priority: 1,
      parseInline: ({ input, start }) => {
        if (!input.startsWith(':wave:', start)) {
          return null;
        }

        return {
          nodes: [{ type: 'text', value: 'low' }],
          nextIndex: start + ':wave:'.length,
        };
      },
    };

    const highPriorityPlugin: WakabamarkEnginePlugin = {
      name: 'high-priority',
      priority: 10,
      parseInline: ({ input, start }) => {
        if (!input.startsWith(':wave:', start)) {
          return null;
        }

        return {
          nodes: [{ type: 'text', value: 'high' }],
          nextIndex: start + ':wave:'.length,
        };
      },
    };

    const engine = new WakabamarkEngine({
      plugins: [lowPriorityPlugin, highPriorityPlugin],
    });

    assert.equal(engine.renderHtml(':wave:'), '<p>high</p>');
  });
});
