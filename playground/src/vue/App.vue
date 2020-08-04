<template>
  <p class="msg">{{ message }}</p>
</template>

<style scoped>
.msg {
  font-family: sans-serif;
}
</style>

<script>
export default {
  data() {
    console.log('Source map test');

    return {
      message: 'This is working'
    }
  }
}
</script>
