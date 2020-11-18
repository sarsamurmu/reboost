<template>
  <h2>Vue.js Example</h2>
  <p class="msg">Count is {{ count }}</p>
  <button v-on:click="increase">Increase</button>
  <span style="padding: 8px;"></span>
  <button v-on:click="decrease">Decrease</button>
</template>

<style scoped>
  h2 {
    font-family: sans-serif;
    font-weight: normal;
  }

  .msg {
    font-family: sans-serif;
  }
</style>

<style scoped>
  .msg {
    font-size: 1.1rem;
  }
</style>

<script>
  export default {
    data() {
      console.log('Source map test');
      return {
        count: 0
      }
    },
    methods: {
      increase() {
        this.count++;
      },
      decrease() {
        this.count--;
      }
    }
  }
</script>
