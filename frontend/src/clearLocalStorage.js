/**
 * Helper script to clear old localStorage leave record data
 * Run this once to clean up localStorage and ensure MongoDB-only usage
 */
export const clearLeaveRecordLocalStorage = () => {
  try {
    const allKeys = Object.keys(localStorage);
    let clearedCount = 0;

    allKeys.forEach(key => {
      if (key.startsWith('leaveRecords_')) {
        localStorage.removeItem(key);
        clearedCount++;
        console.log(`Cleared: ${key}`);
      }
    });

    if (clearedCount > 0) {
      console.log(`Successfully cleared ${clearedCount} leave record entries from localStorage`);
      return { success: true, message: `Cleared ${clearedCount} entries`, count: clearedCount };
    } else {
      console.log('No leave record entries found in localStorage');
      return { success: true, message: 'No entries to clear', count: 0 };
    }
  } catch (error) {
    console.error('Error clearing localStorage:', error);
    return { success: false, message: error.message, count: 0 };
  }
};

// Run automatically on import to clean up
if (typeof window !== 'undefined') {
  console.log('Running localStorage cleanup for leave records...');
  clearLeaveRecordLocalStorage();
}
