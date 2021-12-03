import './App.css';
import {useMemo} from "react";
import {
    BrowserRouter as Router,
    Switch,
    Route,
    Link
} from "react-router-dom";

function App(props) {

    console.log('App', props, fn)

    return (
        <Router>
            <Switch>
                <Route path="/about">
                    <About/>
                </Route>
                <Route path="/users">
                    <Users/>
                </Route>
                <Route path="/">
                    <Home/>
                </Route>
            </Switch>
        </Router>
    );
}


function Home() {
    return <h2>Home</h2>;
}

function About() {
    return <h2>About</h2>;
}

function Users() {
    return <h2>Users</h2>;
}


export default App;
