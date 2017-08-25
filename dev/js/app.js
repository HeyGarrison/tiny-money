import Vue from 'vue/dist/vue.esm';
import VueResource from 'vue-resource';
import VueTouch from 'vue-touch';

import accounting from 'accounting';
import BigNumber from 'bignumber.js';
import _ from 'lodash';
import moment from 'moment';
import { gistPatch, gistGet } from './gist';
import omit from './omit';
import Velocity from 'velocity-animate';
import PullToRefresh from './ptr';

Velocity.defaults.mobileHA = false;
Velocity.defaults.duration = 250;

Vue.use(VueTouch);
Vue.use(VueResource);

const tinybank_key = 'tiny-bank-api-key-abc123';
const tinybank_user = 'tiny-bank-user-abc123';

new Vue({
  el: '#app',
  data: {
    banks: JSON.parse(localStorage.getItem('BANKS')) || [],
    transactions: JSON.parse(localStorage.getItem('TRANSACTIONS')) || [],
    hidden: JSON.parse(localStorage.getItem('HIDDEN')) || [],
    user: JSON.parse(localStorage.getItem('USER')) || {},
    last: localStorage.getItem('LAST'),
    ptr: new PullToRefresh(),
    refreshing: false,
    scrolling: false,
    step: 0,
  },
  http: {
    root: 'https://tiny.money/v1/',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${tinybank_key}`
    }
  },
  created() {
    this.parseTransactions();
    
    if (
      !moment(this.last).add(1, 'minute').isAfter() || 
      this.transactions.length === 0
    ) {
      localStorage.setItem('LAST', moment().toDate());
      this.refresh();
    }
  },
  mounted() {
    this.ptr.init({
      body: '#app',
      ptr: '.ptr',
      callback: this.refresh
    });
  },
  watch: {

  },
  computed: {
    sortedTransactions() {
      return _.chain(this.transactions)
        .filter((t) => {
          return !t.hidden;
        })
        .orderBy([
          'pending',
          'hidden', 
          (t) => {return Math.abs(t.amount)}, 
          'date',
          'name'
        ], [
          'desc', 
          'asc', 
          'desc', 
          'desc',
          'desc'
        ])
        .value();
    },
    sortedTransactionsHidden() {
      return _.chain(this.transactions)
        .filter((t) => {
          return t.hidden;
        })
        .orderBy([
          'pending',
          'hidden', 
          (t) => {return Math.abs(t.amount)}, 
          'date',
          'name'
        ], [
          'desc', 
          'asc', 
          'desc', 
          'desc',
          'desc'
        ])
        .value();
    },
    sortedBanks() {
      return _.orderBy(this.banks, [
        (b) => {return Math.abs(b.net)},
        'name'
      ], [
        'desc',
        'desc'
      ]);
    }
  },
  filters: {
    money(amount) {
      if (!amount)
        return '$0.00';

      amount = new BigNumber(String(amount)).abs().toFixed(2);
      return accounting.formatMoney(amount);
    }
  },
  methods: {
    getTransactions(callback) {
      const lte = moment().endOf('month');
      const gte = moment().subtract(1, 'month');

      this.$http.get(`${tinybank_user}/transactions`, {
        params: {
          step: this.step,
          pending: false,
          limit: 100,
          lte: lte.format('YYYY-MM-DD'),
          gte: gte.format('YYYY-MM-DD')
        }
      }).then((res) => {
        this.parseTransactions(res.data.transactions, gte);

        if (res.data.meta.pagination.has_more) {
          this.step++;
          this.getTransactions(callback);
        } else {
          this.step = 0;

          if (callback)
            callback();
        }
      }).catch((err) => {
        console.error(err);

        if (callback)
          callback();
      });
    },
    parseTransactions(transactions, gte) {
      transactions = transactions || this.transactions;
      gte = gte || moment().subtract(1, 'month');

      this.transactions = _
        .chain(this.transactions)
        .concat(transactions)
        .uniqBy('_id')
        .filter((t) => {
          return gte.isBefore(t.date)
        })
        .each((t) => {
          const date = moment(t.date);
          const bank = _.find(this.banks, {_id: t._bank});

          t.klass = [];

          if (t.pending)
            t.klass.push('pending');

          if (t.amount >= 0) {
            t.klass.push('negative');
          } else {
            t.klass.push('positive');
          }

          t.day = date.date();
          t.month = date.format('MMM');

          if (bank)
            t.info = `${bank.name} ${t.number}`;

          if (_.includes(this.hidden, t._id)) {
            Vue.set(t, 'hidden', true);
          } else {
            Vue.set(t, 'hidden', false);
          }
        })
        .value();

      const clone = _.cloneDeep(this.transactions);
      let clean = omit(clone, ['target', 'action', 'hidden']);
      localStorage.setItem('TRANSACTIONS', JSON.stringify(clean));
    },
    panStartTransaction(e, t) {
      if (Math.abs(e.overallVelocityY) >= Math.abs(e.overallVelocityX))
        return this.scrolling = true;

      if (e.target.classList.contains('transaction')) {
        t.target = e.target;
      } else {
        t.target = e.target.offsetParent;
      }
      
      t.action = t.target.lastChild;
      t.target.classList.remove('animate');
    },
    panTransaction(e, t) {
      if (this.scrolling)
        return;

      if (e.deltaX >= 0) {
        t.target.classList.add('left');
        t.target.classList.remove('right');
      } else {
        t.target.classList.add('right');
        t.target.classList.remove('left');
      }

      if (Math.abs(e.deltaX) >= 60) {
        t.action.classList.add('active');
      } else {
        t.action.classList.remove('active');
      }

      t.target.style.transform = `translateX(${e.deltaX}px)`;
    },
    panEndTransaction(e, t) {
      if (!this.scrolling) {

        // If we're pass the threshold, hide or show
        if (Math.abs(e.deltaX) >= 60) {
          let offset = t.target.offsetWidth;

          if (e.deltaX >= 0) {
            offset = e.deltaX - offset;
            this.animateTransaction(1, t, offset);
          } else {
            offset = e.deltaX + offset;
            this.animateTransaction(0, t, offset);
          }

          t.action.classList.remove('active');
        } 
        
        // Otherwise just reset back to zero
        else {
          Velocity(t.target, {
            right: e.deltaX
          }, {
            complete: () => {
              t.target.style.transform = '';
              t.target.style.right = '';
            }
          });
        }
      }

      this.scrolling = false;
    },

    animateTransaction(direction, t, offset) {
      Velocity(t.target, {
        height: 0,
        right: offset
      }).then(() => {
        if (t.hidden) {
          this.hidden = _.without(this.hidden, t._id);
          Vue.set(t, 'hidden', false);
        } else {
          this.hidden.push(t._id);
          Vue.set(t, 'hidden', true);
        }

        t.target.style.right = '';
        t.target.style.transform = '';
        t.target.style.overflow = 'hidden';

        return gistPatch(this);
      }).then(() => {
        t.target.height = t.target.clientHeight;
        t.target.style.height = '0px';

        Velocity(t.target, {
          height: t.target.height
        }, {
          complete: () => {
            t.target.style.height = '';
            t.target.style.overflow = '';
          }
        });
      });
    },

    enterTransaction(target) {
      target.height = target.clientHeight;
      target.style.height = '0px';
      
      setTimeout(() => {
        Velocity(target, {
          height: target.height
        });
      }, 250);
    },

    getBanks(callback) {
      this.$http.get(`${tinybank_user}/banks`)
        .then((res) => {
          this.banks = res.data.banks;
          localStorage.setItem('BANKS', JSON.stringify(this.banks));

          if (callback)
            callback();
        })
        .catch((err) => {
          console.error(err);

          if (callback)
            callback();
        });
    },
      
    getUser(callback) {
      this.$http.get(`users/${tinybank_user}`)
        .then((res) => {
          this.user = res.data.user;
          localStorage.setItem('USER', JSON.stringify(res.data.user));

          if (callback)
            callback();
        })
        .catch((err) => {
          console.error(err);

          if (callback)
            callback();
        });
    },

    refresh() {
      return new Promise(resolve => {
        if (this.refreshing) {
          return resolve();
        } else {
          this.refreshing = true;
        }

        this.getUser(() => {
          this.getBanks(() => {
            gistGet(this, () => {
              this.getTransactions(() => {
                this.refreshing = false;
                resolve();
              });
            });
          });
        });
      });
    },

    accountKlass(a) {
      const balance = a.type === 'depository' ? -a.balance.current : a.balance.current;
      return balance >= 0 ? 'negative' : 'positive'
    }
  }
});
