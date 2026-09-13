/* =========================================================================
   HARDGATE Setup Intelligence - Data Persistence

   Persists setup data to localStorage and daily backup.
   - Auto-saves every setup recorded
   - Auto-saves every outcome tracked
   - Daily export to JSON for backup
   - Restore on page reload
   - Fallback to in-memory if localStorage unavailable

   ========================================================================= */
'use strict';

class HardgateSetupIntelligencePersistence {
  constructor(setupIntelligence) {
    this.engine = setupIntelligence;
    this.storageKey = 'hg_setup_intelligence_data';
    this.backupKey = 'hg_setup_intelligence_backups';
    this.maxBackups = 30;  // Keep 30 days of daily backups
    this.autoSaveInterval = 60000;  // Save every minute
    this.initialized = false;
  }

  /**
   * Initialize persistence
   * Call once on app startup
   */
  async initialize() {
    if (this.initialized) return;

    console.log('[SetupIntelligence-Persistence] Initializing...');

    // Check if localStorage is available
    if (!this.isStorageAvailable()) {
      console.warn('[SetupIntelligence-Persistence] localStorage not available, using memory only');
      this.initialized = true;
      return;
    }

    // Restore from previous session
    await this.restore();

    // Start auto-save interval
    this.startAutoSave();

    // Setup daily backup
    this.scheduleDailyBackup();

    console.log('[SetupIntelligence-Persistence] ✅ Ready');
    this.initialized = true;
  }

  /**
   * Check if localStorage is available
   */
  isStorageAvailable() {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Save all setup data
   */
  save() {
    if (!this.isStorageAvailable()) return false;

    try {
      const data = {
        timestamp: new Date().toISOString(),
        version: 1,
        setupDatabase: this.serializeDatabase()
      };

      localStorage.setItem(this.storageKey, JSON.stringify(data));
      console.log('[SetupIntelligence-Persistence] Saved');
      return true;
    } catch (e) {
      console.warn('[SetupIntelligence-Persistence] Save failed:', e);
      return false;
    }
  }

  /**
   * Restore data from localStorage
   */
  async restore() {
    if (!this.isStorageAvailable()) {
      console.warn('[SetupIntelligence-Persistence] Cannot restore - no storage');
      return false;
    }

    try {
      const stored = localStorage.getItem(this.storageKey);
      if (!stored) {
        console.log('[SetupIntelligence-Persistence] No previous data to restore');
        return false;
      }

      const data = JSON.parse(stored);
      this.deserializeDatabase(data.setupDatabase);

      console.log('[SetupIntelligence-Persistence] ✅ Restored previous session');
      return true;
    } catch (e) {
      console.error('[SetupIntelligence-Persistence] Restore failed:', e);
      return false;
    }
  }

  /**
   * Serialize database to storable format
   */
  serializeDatabase() {
    const serialized = {
      daily: {},
      byTab: {},
      bySymbol: {},
      byPattern: {}
    };

    // Serialize daily map
    for (const [date, setups] of this.engine.setupDatabase.daily) {
      serialized.daily[date] = setups;
    }

    // Serialize byTab map
    for (const [tab, setups] of this.engine.setupDatabase.byTab) {
      serialized.byTab[tab] = setups;
    }

    // Serialize bySymbol map
    for (const [symbol, setups] of this.engine.setupDatabase.bySymbol) {
      serialized.bySymbol[symbol] = setups;
    }

    // Serialize byPattern map
    for (const [pattern, setups] of this.engine.setupDatabase.byPattern) {
      serialized.byPattern[pattern] = setups;
    }

    return serialized;
  }

  /**
   * Deserialize and restore database
   */
  deserializeDatabase(serialized) {
    // Restore daily
    for (const [date, setups] of Object.entries(serialized.daily || {})) {
      this.engine.setupDatabase.daily.set(date, setups);
    }

    // Restore byTab
    for (const [tab, setups] of Object.entries(serialized.byTab || {})) {
      this.engine.setupDatabase.byTab.set(tab, setups);
    }

    // Restore bySymbol
    for (const [symbol, setups] of Object.entries(serialized.bySymbol || {})) {
      this.engine.setupDatabase.bySymbol.set(symbol, setups);
    }

    // Restore byPattern
    for (const [pattern, setups] of Object.entries(serialized.byPattern || {})) {
      this.engine.setupDatabase.byPattern.set(pattern, setups);
    }

    console.log('[SetupIntelligence-Persistence] Database restored');
  }

  /**
   * Start auto-save interval
   */
  startAutoSave() {
    setInterval(() => {
      this.save();
    }, this.autoSaveInterval);

    console.log('[SetupIntelligence-Persistence] Auto-save started');
  }

  /**
   * Schedule daily backup at midnight
   */
  scheduleDailyBackup() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const timeUntilMidnight = tomorrow - now;

    setTimeout(() => {
      this.createDailyBackup();
      // Then run every 24 hours
      setInterval(() => this.createDailyBackup(), 86400000);
    }, timeUntilMidnight);

    console.log('[SetupIntelligence-Persistence] Daily backup scheduled');
  }

  /**
   * Create daily backup of all data
   */
  createDailyBackup() {
    if (!this.isStorageAvailable()) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      const backupKey = `${this.backupKey}_${today}`;

      const backup = {
        date: today,
        timestamp: new Date().toISOString(),
        data: this.serializeDatabase()
      };

      localStorage.setItem(backupKey, JSON.stringify(backup));

      // Cleanup old backups
      this.cleanupOldBackups();

      console.log('[SetupIntelligence-Persistence] Daily backup created');
    } catch (e) {
      console.warn('[SetupIntelligence-Persistence] Backup failed:', e);
    }
  }

  /**
   * Remove backups older than maxBackups
   */
  cleanupOldBackups() {
    try {
      const backupKeys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.backupKey)) {
          backupKeys.push(key);
        }
      }

      // Sort by date and remove old ones
      backupKeys.sort().reverse();
      for (let i = this.maxBackups; i < backupKeys.length; i++) {
        localStorage.removeItem(backupKeys[i]);
      }

      console.log(`[SetupIntelligence-Persistence] Cleaned up old backups (kept ${Math.min(backupKeys.length, this.maxBackups)})`);
    } catch (e) {
      console.warn('[SetupIntelligence-Persistence] Cleanup failed:', e);
    }
  }

  /**
   * Export setup data as JSON file
   */
  exportToJSON(filename = null) {
    const date = new Date().toISOString().split('T')[0];
    const name = filename || `hardgate-setups-${date}.json`;

    const data = {
      exportDate: new Date().toISOString(),
      totalSetups: this.engine.getClosedSetups().length + this.engine.getOpenSetups().length,
      closedSetups: this.engine.getClosedSetups().length,
      openSetups: this.engine.getOpenSetups().length,
      database: this.serializeDatabase()
    };

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    // Trigger download
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log('[SetupIntelligence-Persistence] Exported:', name);
  }

  /**
   * Import setup data from JSON file
   */
  async importFromJSON(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          this.deserializeDatabase(data.database);
          console.log('[SetupIntelligence-Persistence] Imported successfully');
          resolve(true);
        } catch (error) {
          console.error('[SetupIntelligence-Persistence] Import failed:', error);
          reject(error);
        }
      };

      reader.onerror = () => {
        reject(new Error('File read failed'));
      };

      reader.readAsText(file);
    });
  }

  /**
   * Get list of available backups
   */
  getAvailableBackups() {
    const backups = [];

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.backupKey)) {
          const backup = JSON.parse(localStorage.getItem(key));
          backups.push({
            date: backup.date,
            timestamp: backup.timestamp,
            key: key,
            size: JSON.stringify(backup).length
          });
        }
      }

      return backups.sort((a, b) => new Date(b.date) - new Date(a.date));
    } catch (e) {
      console.warn('[SetupIntelligence-Persistence] Failed to list backups:', e);
      return [];
    }
  }

  /**
   * Restore from a specific backup
   */
  restoreFromBackup(backupKey) {
    try {
      const backup = JSON.parse(localStorage.getItem(backupKey));
      this.deserializeDatabase(backup.data);
      console.log('[SetupIntelligence-Persistence] Restored from backup:', backup.date);
      return true;
    } catch (e) {
      console.error('[SetupIntelligence-Persistence] Restore failed:', e);
      return false;
    }
  }

  /**
   * Clear all data (dangerous!)
   */
  clearAll() {
    if (!confirm('⚠️ Clear ALL setup data? This cannot be undone.')) {
      return false;
    }

    try {
      localStorage.removeItem(this.storageKey);

      // Remove all backups
      const backupKeys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.backupKey)) {
          backupKeys.push(key);
        }
      }
      backupKeys.forEach(key => localStorage.removeItem(key));

      // Clear in-memory database
      this.engine.setupDatabase.daily.clear();
      this.engine.setupDatabase.byTab.clear();
      this.engine.setupDatabase.bySymbol.clear();
      this.engine.setupDatabase.byPattern.clear();

      console.log('[SetupIntelligence-Persistence] All data cleared');
      return true;
    } catch (e) {
      console.error('[SetupIntelligence-Persistence] Clear failed:', e);
      return false;
    }
  }

  /**
   * Get storage status
   */
  getStatus() {
    const backups = this.getAvailableBackups();
    const totalSetups = this.engine.getClosedSetups().length + this.engine.getOpenSetups().length;

    return {
      storageAvailable: this.isStorageAvailable(),
      initialized: this.initialized,
      totalSetups: totalSetups,
      closedSetups: this.engine.getClosedSetups().length,
      openSetups: this.engine.getOpenSetups().length,
      availableBackups: backups.length,
      lastBackup: backups.length > 0 ? backups[0].date : null,
      timestamp: new Date().toISOString()
    };
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HardgateSetupIntelligencePersistence;
}

if (typeof window !== 'undefined') {
  window.HardgateSetupIntelligencePersistence = HardgateSetupIntelligencePersistence;
}
