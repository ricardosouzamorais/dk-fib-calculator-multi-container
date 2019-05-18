import React, { Component } from 'react';
import axios from 'axios';

class Fib extends Component {
    state = {
        seenIndexes: [],
        values: {},
        index: ''
    };

    componentDidMount() {
        this.fetchValues();
        this.fetchIndexes();
    }

    async fetchValues() {
        const values = await axios.get('/api/values/current');
        this.setState({ values: values.data });
    }

    async fetchIndexes() {
        const seenIndexes = await axios.get('/api/values/all');
        this.setState({ 
            seenIndexes : seenIndexes.data 
        });
    }

    //bound function
    handleSubmit = async (event) => {
        //preventing the form to submit itself
        event.preventDefault();

        await axios.post('api/values', {
            index: this.state.index
        });

        this.setState({ index: '' });
    };

    renderSeenIndexes() {
        // Default returning type when pulling data out of PostgreSQL 
        return this.state.seenIndexes && this.state.seenIndexes instanceof Map && this.state.seenIndexes.map(({ number }) => number).join(', ');
    }

    renderValues() {
        const entries = [];

        // Calculated values stored into Redis. When pulling data out of Redis we are
        // going to get back an object that is going to have a bunch of key value pairs
        for (let key in this.state.values) {
            entries.push(
                <div key={key}>
                    For index {key} I calculated {this.state.values[key]}
                </div>
            );
        }

        return entries;
    }

    render() {
        return (
            <div>
                <form onSubmit={this.handleSubmit}>
                    <label>Enter your index:</label>
                    <input 
                        value={this.state.index}
                        onChange={event => this.setState({ index : event.target.value })}
                    />
                    <button>Submit</button>
                </form>

                <h3>Indexes I have seen:</h3>
                {this.renderSeenIndexes()}

                <h3>Calculated Values:</h3>
                {this.renderValues()}
            </div>
        );
    }
}

export default Fib;