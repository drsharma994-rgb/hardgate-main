/* store.js — lightweight Publish/Subscribe event store.
 *
 * Part of the vanilla-JS architecture refactor (2/4): decouples state
 * mutations (WebSocket ticks, API polling, manual refresh) from UI updates.
 * Producers publish named events with a data payload; UI components
 * subscribe once and redraw automatically whenever new data arrives,
 * instead of being called directly from inside the mutation site.
 *
 * Usage:
 *   const unsub = Store.subscribe('PRICE_UPDATE', (d) => { ... });
 *   Store.publish('PRICE_UPDATE', { symbol: 'BTCUSD', price: 64500 });
 *   unsub(); // stop listening
 */
const Store = {
  events: {},
  subscribe(event, callback) {
    if (!this.events[event]) this.events[event] = [];
    this.events[event].push(callback);
    return () => {
      this.events[event] = this.events[event].filter((cb) => cb !== callback);
    };
  },
  publish(event, data) {
    if (this.events[event]) {
      this.events[event].forEach((callback) => {
        try {
          callback(data);
        } catch (e) {
          console.warn('Store subscriber error for', event, e);
        }
      });
    }
  }
};
