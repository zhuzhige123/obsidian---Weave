<script lang="ts">
  interface Props { data?: any[]; columns?: any[]; }
  let { data = [], columns = [] }: Props = $props();
</script>

<div class="cursor-table">
  <table>
    <thead>
      <tr>
        {#each columns as col}
          <th>{col.title}</th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#each data as row}
        <tr>
          {#each columns as col}
            <td>{row[col.key]}</td>
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .cursor-table { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: var(--weave-spacing-sm); text-align: left; border-bottom: 1px solid var(--weave-border); }
  th { font-weight: 600; background: var(--weave-surface-alt); }
</style>
