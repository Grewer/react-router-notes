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
