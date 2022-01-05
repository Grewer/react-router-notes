# react-router 源码阅读

这次的版本是 6.2.1


## 使用

相比较 5.x 版本, <Switch>元素升级为了<Routes>

简单的 v6 例子:

```jsx
function App(){
    return  <BrowserRouter>
        <Routes>
            <Route path="/about" element={<About/>}/>
            <Route path="/users" element={<Users/>}/>
            <Route path="/" element={<Home/>}/>
        </Routes>
    </BrowserRouter>
}
```

## context

在 react-router 中, 他创建了两个 context 供后续的使用, 当然这两个 context 是在内部的, 并没有 API 暴露出来

### NavigationContext

```tsx
/**
 * 一个路由对象的基本构成
 */
export interface RouteObject {
    caseSensitive?: boolean;
    children?: RouteObject[];
    element?: React.ReactNode;
    index?: boolean;
    path?: string;
}

// 常用的参数类型
export type Params<Key extends string = string> = {
    readonly [key in Key]: string | undefined;
};

/**
 * 一个 路由匹配 接口
 */
export interface RouteMatch<ParamKey extends string = string> {
    /**
     * 动态参数的名称和值的URL
     */
    params: Params<ParamKey>;
    /**
     * 路径名
     */
    pathname: string;
    /**
     * 之前匹配的路径名
     */
    pathnameBase: string;
    /**
     * 匹配到的路由对象
     */
    route: RouteObject;
}

interface RouteContextObject {
    outlet: React.ReactElement | null;
    matches: RouteMatch[];
}

const RouteContext = React.createContext<RouteContextObject>({
    outlet: null,
    matches: []
});
```

### LocationContext

```tsx
import type {
    Location,
    Action as NavigationType
} from "history";

interface LocationContextObject {
    location: Location; // 原生的 location 对象, window.location

    /**
     * enum Action 一个枚举, 他有三个参数, 代表路由三种动作
     * Pop = "POP",
     * Push = "PUSH",
     * Replace = "REPLACE"
     */
    navigationType: NavigationType;  
}

const LocationContext = React.createContext<LocationContextObject>(null!);

```

## MemoryRouter

在 `react-router-dom` 的源码解析中我们说到了 `BrowserRouter` 和 `HashRouter`, 那么这个 `MemoryRouter`又是什么呢

他是将 URL 的历史记录保存在内存中的 <Router>（不读取或写入地址栏）。在测试和非浏览器环境中很有用，例如 React Native。

他的源码和其他两个 Router 最大的区别就是一个 `createMemoryHistory` 方法, 此方法也来自于 `history` 库中
```tsx
export function MemoryRouter({
                                 basename,
                                 children,
                                 initialEntries,
                                 initialIndex
                             }: MemoryRouterProps): React.ReactElement {
    let historyRef = React.useRef<MemoryHistory>();
    if (historyRef.current == null) {
        historyRef.current = createMemoryHistory({ initialEntries, initialIndex });
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

那我们现在来看一看这个方法, 这里只讲他与 `createHashHistory` 不同的地方:

```tsx
export function createMemoryHistory(
  options: MemoryHistoryOptions = {}
): MemoryHistory {
  let { initialEntries = ['/'], initialIndex } = options; // 不同的初始值 initialEntries
  let entries: Location[] = initialEntries.map((entry) => {
    let location = readOnly<Location>({
      pathname: '/',
      search: '',
      hash: '',
      state: null,
      key: createKey(), // 通过 random 生成唯一值
      ...(typeof entry === 'string' ? parsePath(entry) : entry)
    }); // 这里的 location 属于是直接创建, HashHistory 中是使用的 window.location
      // readOnly方法 可以看做 (obj)=>obj, 并没有太大作用
    return location;
  });
 

  function push(to: To, state?: any) {
    let nextAction = Action.Push;
    let nextLocation = getNextLocation(to, state);
    function retry() {
      push(to, state);
    }

    // 忽略其他类似的代码
    
    if (allowTx(nextAction, nextLocation, retry)) {
      index += 1;
      // 别处是调用原生 API, history.pushState
      entries.splice(index, entries.length, nextLocation);
      applyTx(nextAction, nextLocation);
    }
  }

  
  // 与 push 类似, 忽略 replace

  function go(delta: number) {
      // 与HashHistory不同, 也是走的类似 push
    let nextIndex = clamp(index + delta, 0, entries.length - 1);
    let nextAction = Action.Pop;
    let nextLocation = entries[nextIndex];
    function retry() {
      go(delta);
    }

    if (allowTx(nextAction, nextLocation, retry)) {
      index = nextIndex;
      applyTx(nextAction, nextLocation);
    }
  }

  let history: MemoryHistory = {
    // 基本相同
  };

  return history;
}
```

## Navigate

用来改变 当然 location 的方法, 是一个 react-router 抛出的 API

### 使用方式:


```jsx

function App() {
    // 一旦 user 是有值的, 就跳转至 `/dashboard` 页面了
    // 算是跳转路由的一种方案
    return <div>
        {user && (
            <Navigate to="/dashboard" replace={true} />
        )}
        <form onSubmit={event => this.handleSubmit(event)}>
            <input type="text" name="username" />
            <input type="password" name="password" />
        </form>
    </div>
}
```

### 源码

```tsx

export function Navigate({ to, replace, state }: NavigateProps): null {
    // 直接调用 useNavigate 来获取 navigate 方法, 并且  useEffect 每次都会触发
    
    let navigate = useNavigate();
    React.useEffect(() => {
        navigate(to, { replace, state });
    });

    return null;
}

```




## Outlet

用来渲染子路由的元素, 简单来说就是一个路由的占位符

代码很简单, 使用的逻辑是这样

### 使用方式:

```jsx

function App(props) {
    return (
        <HashRouter>
            <Routes>
                <Route path={'/'} element={<Dashboard></Dashboard>}>
                    <Route path="qqwe" element={<About/>}/>
                    <Route path="about" element={<About/>}/>
                    <Route path="users" element={<Users/>}/>
                </Route>
            </Routes>
        </HashRouter>
    );
}

// 其中外层的Dashboard:

function Dashboard() {
    return (
        <div>
            <h1>Dashboard</h1>
            <Outlet />
            // 这里就会渲染他的子路由了
            // 和以前 children 差不多
        </div>
    );
}
```

### 源码

```tsx
export function Outlet(props: OutletProps): React.ReactElement | null {
    return useOutlet(props.context);
}

export function useOutlet(context?: unknown): React.ReactElement | null {
    let outlet = React.useContext(RouteContext).outlet;
    if (outlet) {
        return (
            <OutletContext.Provider value={context}>{outlet}</OutletContext.Provider>
        );
    }
    return outlet;
}
```



## useParams
从当前URL所匹配的路径中, 返回一个对象的键/值对的动态参数。

```tsx
function useParams<
    ParamsOrKey extends string | Record<string, string | undefined> = string
    >(): Readonly<
    [ParamsOrKey] extends [string] ? Params<ParamsOrKey> : Partial<ParamsOrKey>
    > {
    // 直接获取了 RouteContext 中 matches 数组的最后一个对象, 如果没有就是空对象
    let { matches } = React.useContext(RouteContext);
    let routeMatch = matches[matches.length - 1];
    return routeMatch ? (routeMatch.params as any) : {};
}
```


## useResolvedPath

将给定的`to'值的路径名与当前位置进行比较

在 `<NavLink>` 这个组件中使用到

```tsx
function useResolvedPath(to: To): Path {
    let { matches } = React.useContext(RouteContext);
    let { pathname: locationPathname } = useLocation();
    
    // 合并成一个 json 字符, 至于为什么又要解析, 是为了添加字符层的缓存, 如果是一个对象, 就不好浅比较了
    let routePathnamesJson = JSON.stringify(
        matches.map(match => match.pathnameBase)
    );
    
    return React.useMemo(
        () => resolveTo(to, JSON.parse(routePathnamesJson), locationPathname),
        [to, routePathnamesJson, locationPathname]
    );
}
```

## useRoutes

useRoutes钩子的功能等同于<Routes>，但它使用JavaScript对象而不是<Route>元素来定义路由。
相当于是一种 schema 版本, 更好的配置性


### 使用方式:

如果使用过 umi, 是不是会感觉到一模一样

```tsx
function App() {
  let element = useRoutes([
    { path: "/", element: <Home /> },
    { path: "dashboard", element: <Dashboard /> },
    {
      path: "invoices",
      element: <Invoices />,
      children: [
        { path: ":id", element: <Invoice /> },
        { path: "sent", element: <SentInvoices /> }
      ]
    },
    { path: "*", element: <NotFound /> }
  ]);

  return element;
}
```

### 源码

```tsx
export function useRoutes(
    routes: RouteObject[],
    locationArg?: Partial<Location> | string
): React.ReactElement | null {
    
    let { matches: parentMatches } = React.useContext(RouteContext);
    let routeMatch = parentMatches[parentMatches.length - 1];
    // 获取匹配的 route
    
    let parentParams = routeMatch ? routeMatch.params : {};
    let parentPathname = routeMatch ? routeMatch.pathname : "/";
    let parentPathnameBase = routeMatch ? routeMatch.pathnameBase : "/";
    let parentRoute = routeMatch && routeMatch.route;
    // 这里上面都是一些参数, 没有就是默认值
    
    //  等于 React.useContext(LocationContext).location, 约等于原生的 location
    let locationFromContext = useLocation();

    let location;
    if (locationArg) { // 对于配置项参数的一些判断
        let parsedLocationArg =
            typeof locationArg === "string" ? parsePath(locationArg) : locationArg;
        location = parsedLocationArg;
    } else {
        location = locationFromContext;
    }
    // 如果参数里有则使用参数里的, 如果没有使用 context 的
    

    let pathname = location.pathname || "/";
    let remainingPathname =
        parentPathnameBase === "/"
            ? pathname
            : pathname.slice(parentPathnameBase.length) || "/";
    // matchRoutes 大概的作用是通过pathname遍历寻找,匹配到的路由    集体源码放在下面讲
    let matches = matchRoutes(routes, { pathname: remainingPathname });

    return _renderMatches(
        matches &&
        matches.map(match =>
            Object.assign({}, match, {
                params: Object.assign({}, parentParams, match.params),
                pathname: joinPaths([parentPathnameBase, match.pathname]),
                pathnameBase:
                    match.pathnameBase === "/"
                        ? parentPathnameBase
                        : joinPaths([parentPathnameBase, match.pathnameBase])
            })
        ),
        parentMatches
    );
}
```


### matchRoutes

```tsx
function matchRoutes(
    routes: RouteObject[],
    locationArg: Partial<Location> | string,
    basename = "/"
): RouteMatch[] | null {
    let location =
        typeof locationArg === "string" ? parsePath(locationArg) : locationArg;

    let pathname = stripBasename(location.pathname || "/", basename);

    if (pathname == null) {
        return null;
    }

    let branches = flattenRoutes(routes);
    rankRouteBranches(branches);

    let matches = null;
    for (let i = 0; matches == null && i < branches.length; ++i) {
        matches = matchRouteBranch(branches[i], pathname);
    }

    return matches;
}
```


### 工具函数 stripBasename

```tsx
function stripBasename(pathname: string, basename: string): string | null {
    if (basename === "/") return pathname;

    if (!pathname.toLowerCase().startsWith(basename.toLowerCase())) {
        return null;
    }

    let nextChar = pathname.charAt(basename.length);
    if (nextChar && nextChar !== "/") {
        // pathname does not start with basename/
        return null;
    }

    return pathname.slice(basename.length) || "/";
}
```

### _renderMatches

```tsx
function _renderMatches(
    matches: RouteMatch[] | null,
    parentMatches: RouteMatch[] = []
): React.ReactElement | null {
    if (matches == null) return null;

    return matches.reduceRight((outlet, match, index) => {
        return (
            <RouteContext.Provider
                children={
                    match.route.element !== undefined ? match.route.element : <Outlet />
                }
                value={{
                    outlet,
                    matches: parentMatches.concat(matches.slice(0, index + 1))
                }}
            />
        );
    }, null as React.ReactElement | null);
}
```
