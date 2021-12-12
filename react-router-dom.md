# react-router-dom 源码阅读

这次的版本是 6.0.2

## API

这里只讲 react-router-dom 提供的 API, 像是 Routes, Router 这些都是 react-router 提供的


### BrowserRouter, HashRouter

BrowserRouter 和 hashRouter 的主要区别就在于使用的路由 API

#### 简单解释

> BrowserRouter

它使用了 history 库 的API，也就是说，浏览器（IE 9和更低版本以及同时代的浏览器）是不可用的。  
客户端React应用程序能够维护干净的路由，如 `example.com/react/route` ，但需要得到Web服务器的支持。  
这需要Web服务器应该被配置为单页应用程序，即为/react/route路径或服务器上的任何其他路由提供相同的index.html。 

> HashRouter

它使用URL哈希，对支持的浏览器或网络服务器没有限制, 如 `example.com/#/react/route.`

效果是所有后续的URL路径内容在服务器请求中被忽略（即你发送 "www.mywebsite.com/#/person/john"，服务器得到 "www.mywebsite.com"。
因此，服务器将返回前#URL响应，然后后#路径将由你的客户端反应程序进行解析处理。


#### 代码解析

先说 hashRouter , 他的依赖度是最低的, 代码也很简单:

```tsx
import { createHashHistory } from "history";

function HashRouter({ basename, children, window }: HashRouterProps) {
    let historyRef = React.useRef<HashHistory>(); // 用来存储 createHashHistory 结果 
    if (historyRef.current == null) {
        historyRef.current = createHashHistory({ window });
    }

    let history = historyRef.current;
    let [state, setState] = React.useState({
        action: history.action,
        location: history.location
    });

    React.useLayoutEffect(() => history.listen(setState), [history]);

    return (
        <Router
            basename={basename}
            children={children}
            location={state.location}
            navigationType={state.action}
            navigator={history}
        />
    );
}
```

这里需要了解的一个 API 是 `createHashHistory`, 他来自于 [history](https://github.com/remix-run/history) 仓库, 这里我们需要解析一下这个方法:

```tsx

function createHashHistory(
  options: HashHistoryOptions = {}
): HashHistory {
  let { window = document.defaultView! } = options;
  let globalHistory = window.history;

  function getIndexAndLocation(): [number, Location] {
    let {
      pathname = '/',
      search = '',
      hash = ''
    } = parsePath(window.location.hash.substr(1));
    let state = globalHistory.state || {};
    return [
      state.idx,
      readOnly<Location>({
        pathname,
        search,
        hash,
        state: state.usr || null,
        key: state.key || 'default'
      })
    ];
  }

  let blockedPopTx: Transition | null = null;
  function handlePop() {
    if (blockedPopTx) {
      blockers.call(blockedPopTx);
      blockedPopTx = null;
    } else {
      let nextAction = Action.Pop;
      let [nextIndex, nextLocation] = getIndexAndLocation();

      if (blockers.length) {
        if (nextIndex != null) {
          let delta = index - nextIndex;
          if (delta) {
            // Revert the POP
            blockedPopTx = {
              action: nextAction,
              location: nextLocation,
              retry() {
                go(delta * -1);
              }
            };

            go(delta);
          }
        } else {
          // Trying to POP to a location with no index. We did not create
          // this location, so we can't effectively block the navigation.
          warning(
            false,
            // TODO: Write up a doc that explains our blocking strategy in
            // detail and link to it here so people can understand better
            // what is going on and how to avoid it.
            `You are trying to block a POP navigation to a location that was not ` +
              `created by the history library. The block will fail silently in ` +
              `production, but in general you should do all navigation with the ` +
              `history library (instead of using window.history.pushState directly) ` +
              `to avoid this situation.`
          );
        }
      } else {
        applyTx(nextAction);
      }
    }
  }

  window.addEventListener(PopStateEventType, handlePop);

  // popstate does not fire on hashchange in IE 11 and old (trident) Edge
  // https://developer.mozilla.org/de/docs/Web/API/Window/popstate_event
  window.addEventListener(HashChangeEventType, () => {
    let [, nextLocation] = getIndexAndLocation();

    // Ignore extraneous hashchange events.
    if (createPath(nextLocation) !== createPath(location)) {
      handlePop();
    }
  });

  let action = Action.Pop;
  let [index, location] = getIndexAndLocation();
  let listeners = createEvents<Listener>();
  let blockers = createEvents<Blocker>();

  if (index == null) {
    index = 0;
    globalHistory.replaceState({ ...globalHistory.state, idx: index }, '');
  }

  function getBaseHref() {
    let base = document.querySelector('base');
    let href = '';

    if (base && base.getAttribute('href')) {
      let url = window.location.href;
      let hashIndex = url.indexOf('#');
      href = hashIndex === -1 ? url : url.slice(0, hashIndex);
    }

    return href;
  }

  function createHref(to: To) {
    return getBaseHref() + '#' + (typeof to === 'string' ? to : createPath(to));
  }

  function getNextLocation(to: To, state: any = null): Location {
    return readOnly<Location>({
      pathname: location.pathname,
      hash: '',
      search: '',
      ...(typeof to === 'string' ? parsePath(to) : to),
      state,
      key: createKey()
    });
  }

  function getHistoryStateAndUrl(
    nextLocation: Location,
    index: number
  ): [HistoryState, string] {
    return [
      {
        usr: nextLocation.state,
        key: nextLocation.key,
        idx: index
      },
      createHref(nextLocation)
    ];
  }

  function allowTx(action: Action, location: Location, retry: () => void) {
    return (
      !blockers.length || (blockers.call({ action, location, retry }), false)
    );
  }

  function applyTx(nextAction: Action) {
    action = nextAction;
    [index, location] = getIndexAndLocation();
    listeners.call({ action, location });
  }

  function push(to: To, state?: any) {
    let nextAction = Action.Push;
    let nextLocation = getNextLocation(to, state);
    function retry() {
      push(to, state);
    }

    warning(
      nextLocation.pathname.charAt(0) === '/',
      `Relative pathnames are not supported in hash history.push(${JSON.stringify(
        to
      )})`
    );

    if (allowTx(nextAction, nextLocation, retry)) {
      let [historyState, url] = getHistoryStateAndUrl(nextLocation, index + 1);

      // TODO: Support forced reloading
      // try...catch because iOS limits us to 100 pushState calls :/
      try {
        globalHistory.pushState(historyState, '', url);
      } catch (error) {
        // They are going to lose state here, but there is no real
        // way to warn them about it since the page will refresh...
        window.location.assign(url);
      }

      applyTx(nextAction);
    }
  }

  function replace(to: To, state?: any) {
    let nextAction = Action.Replace;
    let nextLocation = getNextLocation(to, state);
    function retry() {
      replace(to, state);
    }

    warning(
      nextLocation.pathname.charAt(0) === '/',
      `Relative pathnames are not supported in hash history.replace(${JSON.stringify(
        to
      )})`
    );

    if (allowTx(nextAction, nextLocation, retry)) {
      let [historyState, url] = getHistoryStateAndUrl(nextLocation, index);

      // TODO: Support forced reloading
      globalHistory.replaceState(historyState, '', url);

      applyTx(nextAction);
    }
  }

  function go(delta: number) {
    globalHistory.go(delta);
  }

  let history: HashHistory = {
    get action() {
      return action;
    },
    get location() {
      return location;
    },
    createHref,
    push,
    replace,
    go,
    back() {
      go(-1);
    },
    forward() {
      go(1);
    },
    listen(listener) {
      return listeners.push(listener);
    },
    block(blocker) {
      let unblock = blockers.push(blocker);

      if (blockers.length === 1) {
        window.addEventListener(BeforeUnloadEventType, promptBeforeUnload);
      }

      return function () {
        unblock();

        // Remove the beforeunload listener so the document may
        // still be salvageable in the pagehide event.
        // See https://html.spec.whatwg.org/#unloading-documents
        if (!blockers.length) {
          window.removeEventListener(BeforeUnloadEventType, promptBeforeUnload);
        }
      };
    }
  };

  return history;
}

```
// TODO 这里需要简化下代码

### Link


### NavLink

### useLinkClickHandler


### useSearchParams


### createSearchParams


## 引用

- https://stackoverflow.com/questions/51974369/what-is-the-difference-between-hashrouter-and-browserrouter-in-react
