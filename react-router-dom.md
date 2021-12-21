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
import {createHashHistory} from "history";

function HashRouter({basename, children, window}: HashRouterProps) {
    let historyRef = React.useRef<HashHistory>(); // 用来存储 createHashHistory 结果 
    if (historyRef.current == null) {
        historyRef.current = createHashHistory({window});
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
/**
 * 此方法里并不是全部的源码, 省略了部分不太 core 的代码
 */
function createHashHistory(
    options: HashHistoryOptions = {}
): HashHistory {
    let {window = document.defaultView!} = options; // window 是传递的参数
    let globalHistory = window.history; // 全局的 history 对象

    // 获取当前 state.idx 和 location 对象
    function getIndexAndLocation(): [number, Location] {
        let {
            pathname = '/',
            search = '',
            hash = ''
        } = parsePath(window.location.hash.substr(1)); // 解析 hash
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

    // pop 的操作 最终调用的是 go() 函数
    function handlePop() {
        // 省略
    }

    // popstate 事件监听
    window.addEventListener(PopStateEventType, handlePop);

    // hashchange 事件监听  ie11 中存在问题
    window.addEventListener(HashChangeEventType, () => {
        let [, nextLocation] = getIndexAndLocation();

        // 忽略外部的 hashchange 事件  createPath = pathname + search + hash 
        if (createPath(nextLocation) !== createPath(location)) {
            handlePop();
        }
    });

    // Action 是一个 枚举, Pop = 'POP'
    let action = Action.Pop;
    let [index, location] = getIndexAndLocation();

    /**
     *  createEvents 方法
     *  一个闭包方法, 维护一个数组,类似观察者模式, 返回 push, call 两个方法
     */
    let listeners = createEvents<Listener>();
    let blockers = createEvents<Blocker>();
    
    // 常用的 push 方法
    function push(to: To, state?: any) {
        let nextAction = Action.Push; // 枚举 Action.Push = 'PUSH'
        let nextLocation = getNextLocation(to, state); // 生成一个新的 location 对象

        function retry() {
            push(to, state);
        }

        // blockers 为空的时候
        if (allowTx(nextAction, nextLocation, retry)) {
            // 根据 location 生成需要的对象, 只是数据格式更改了下
            /* historyState = {
                usr: nextLocation.state,
                key: nextLocation.key,
                idx: index
            }*/
            let [historyState, url] = getHistoryStateAndUrl(nextLocation, index + 1);

            try {
                // 调用原生 API, history.pushState
                globalHistory.pushState(historyState, '', url);
            } catch (error) {
                // 不兼容就使用这个
                window.location.assign(url);
            }
            applyTx(nextAction); // listeners 中添加回调 nextAction
        }
    }

    function replace(to: To, state?: any) {
        // 同 push, 只不过调用的原生改成了这个  globalHistory.replaceState(historyState, '', url);
    }

    function go(delta: number) { // 原生 go 方法
        globalHistory.go(delta);
    }

    let history: HashHistory = { // 定义的局部 history 对象, 最后要返回的
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
                // 在页面 UnMount 的时候调用
                unblock();
                if (!blockers.length) {
                    window.removeEventListener(BeforeUnloadEventType, promptBeforeUnload);
                }
            };
        }
    };

    return history;
}

```

### Link

一个经常用到的小组件, 常用来做跳转

```tsx

const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(
    function LinkWithRef(
        { onClick, reloadDocument, replace = false, state, target, to, ...rest },
        ref
    ) {
        // useHref 来自于 react-router 中, 用来 parse URL
        let href = useHref(to);
        
        // 真实点击跳转调用的函数, 具体源码在下面给出
        let internalOnClick = useLinkClickHandler(to, { replace, state, target });
        
        // 点击 a 标签的句柄, 如果有 onClick 事件 则优先
        function handleClick(
            event: React.MouseEvent<HTMLAnchorElement, MouseEvent>
        ) {
            if (onClick) onClick(event);
            if (!event.defaultPrevented && !reloadDocument) {
                internalOnClick(event);
            }
        }

        return (
            <a
                {...rest}
                href={href}
                onClick={handleClick}
                ref={ref}
                target={target}
            />
        );
    }
);
```

#### useLinkClickHandler 

来看看这个 hooks 的具体构成

```tsx
export function useLinkClickHandler<E extends Element = HTMLAnchorElement>(
    to: To,
    {
        target,
        replace: replaceProp,
        state
    }: {
        target?: React.HTMLAttributeAnchorTarget;
        replace?: boolean;
        state?: any;
    } = {}
): (event: React.MouseEvent<E, MouseEvent>) => void {
    // 来源于 react-router, 获取 navigate 函数, 可以用来跳转
    let navigate = useNavigate();
    // 获取当前的 location 对象(非 window.location)
    let location = useLocation();
    // 同样来源于react-router,   解析 to, 获取 path
    let path = useResolvedPath(to);

    return React.useCallback(
        (event: React.MouseEvent<E, MouseEvent>) => {
            if (
                event.button === 0 && // 忽略除了左键点击以外的, 参考: https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/button
                (!target || target === "_self") && 
                !isModifiedEvent(event) // 忽略各类键盘按钮, 参考 https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent
                //  isModifiedEvent = !!(event.metaKey || event.altKey || event.ctrlKey || event.shiftKey);
            ) {
                event.preventDefault();

                // 对比是否有变化
                let replace =
                    !!replaceProp || createPath(location) === createPath(path);

                navigate(to, { replace, state });
            }
        },
        [location, navigate, path, replaceProp, state, target, to]
    );
}
```

### NavLink

等于是对 Link 组件的包装

```tsx
const NavLink = React.forwardRef<HTMLAnchorElement, NavLinkProps>(
    function NavLinkWithRef(
        {
            "aria-current": ariaCurrentProp = "page",
            caseSensitive = false,
            className: classNameProp = "",
            end = false,
            style: styleProp,
            to,
            ...rest
        },
        ref
    ) {
        // 这两个 hooks 上述已经说过
        let location = useLocation();
        let path = useResolvedPath(to);

        let locationPathname = location.pathname;
        let toPathname = path.pathname;
        if (!caseSensitive) { // 支持字符串大小写不敏感
            locationPathname = locationPathname.toLowerCase();
            toPathname = toPathname.toLowerCase();
        }

        // 是否 active
        // /user =>  /user/name 
        let isActive =
            locationPathname === toPathname ||
            (!end &&
                locationPathname.startsWith(toPathname) &&
                locationPathname.charAt(toPathname.length) === "/");
        
        // aria 是帮助残障人士辅助阅读的
        let ariaCurrent = isActive ? ariaCurrentProp : undefined;

        // class 样式计算
        let className: string;
        if (typeof classNameProp === "function") {
            className = classNameProp({ isActive });
        } else {
            className = [classNameProp, isActive ? "active" : null]
                .filter(Boolean)
                .join(" ");
        }

        let style =
            typeof styleProp === "function" ? styleProp({ isActive }) : styleProp;

        return (
            <Link
                {...rest}
                aria-current={ariaCurrent}
                className={className}
                ref={ref}
                style={style}
                to={to}
            />
        );
    }
);
```

### useSearchParams

用来获取/设置 query 的 hooks

```tsx
export function useSearchParams(defaultInit?: URLSearchParamsInit) {

    // createSearchParams 的源码下面会讲, 大体是包装了 URLSearchParams 
    // 相关知识点: https://developer.mozilla.org/zh-CN/docs/Web/API/URLSearchParams
    let defaultSearchParamsRef = React.useRef(createSearchParams(defaultInit));

    // 获取 location 
    let location = useLocation();
    
    // 解析, 通过对比 更新
    let searchParams = React.useMemo(() => {
        let searchParams = createSearchParams(location.search);

        for (let key of defaultSearchParamsRef.current.keys()) {
            if (!searchParams.has(key)) {
                defaultSearchParamsRef.current.getAll(key).forEach(value => {
                    searchParams.append(key, value);
                });
            }
        }

        return searchParams;
    }, [location.search]);

    let navigate = useNavigate();
    // 通过 navigate 方法 实现 location.search 的变更
    let setSearchParams = React.useCallback(
        (
            nextInit: URLSearchParamsInit,
            navigateOptions?: { replace?: boolean; state?: any }
        ) => {
            // URLSearchParams toString 就成了 query 格式
            navigate("?" + createSearchParams(nextInit), navigateOptions);
        },
        [navigate]
    );

    return [searchParams, setSearchParams] as const;
}
```

### createSearchParams

```tsx

function createSearchParams(
    init: URLSearchParamsInit = ""
): URLSearchParams {
    return new URLSearchParams(
        typeof init === "string" ||
        Array.isArray(init) ||
        init instanceof URLSearchParams
            ? init
            : Object.keys(init).reduce((memo, key) => {
                let value = init[key];
                return memo.concat(
                    Array.isArray(value) ? value.map(v => [key, v]) : [[key, value]]
                );
            }, [] as ParamKeyValuePair[])
    );
}
```

## 引用

- https://stackoverflow.com/questions/51974369/what-is-the-difference-between-hashrouter-and-browserrouter-in-react
