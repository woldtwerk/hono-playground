import { LitElement, html } from 'lit';
import { property } from 'lit/decorators.js';

class Counter extends LitElement {

  @property({ type: Number })
  count = 0;

  increment() {
    this.count++;
  }

  decrement() {
    this.count--;
  }
  
  render() {
    return html`
      <h2>Counter</h2>
      <button @click=${this.increment}>+</button>
      <span>${this.count}</span>
      <button @click=${this.decrement}>-</button>
    `;
  }
}
customElements.define('my-counter', Counter);
