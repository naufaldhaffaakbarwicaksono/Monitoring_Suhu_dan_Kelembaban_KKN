document.addEventListener('DOMContentLoaded', function() {
  console.log('📱 DOM loaded, initializing sensor monitoring app...');
  
  // Test Chart.js availability
  if (typeof Chart === 'undefined') {
    console.error('❌ Chart.js is not loaded!');
    const chartContainer = document.querySelector('.chart-container');
    if (chartContainer) {
      chartContainer.innerHTML = `
        <div style="text-align: center; padding: 50px; color: #666;">
          <h3>Chart.js Library Not Loaded</h3>
          <p>Unable to load charting library. Please check your internet connection.</p>
        </div>
      `;
    }
    return;
  }
  
  // Global variables
  let allHistoryData = [];
  let currentPeriod = 0.125; // Default to 3 hours (terkini)
  let chartData = []; // Cached chart data
  let isLoadingData = false; // Prevent multiple simultaneous loads
  let lastUpdateTime = 0; // Throttle real-time updates
  let fullscreenChart = null; // Fullscreen chart instance
  let isFullscreenMode = false;
  
  // HTTP Polling variables (replaces MQTT)
  let connectionStatus = { connected: false, lastPoll: null };
  let pollingInterval = null;
  let pollingFrequency = 5000; // 5 seconds
  
  // Initialize chart after a small delay to ensure DOM is ready
  setTimeout(() => {
    console.log('🎯 Attempting to initialize chart...');
    chart = initializeChart();
    setupFullscreenFunctionality();
    // Load initial data only after chart is initialized
    if (chart) {
      console.log('✅ Chart initialized successfully, loading initial data...');
      loadDashboardData();
      startPolling(); // Start HTTP polling for real-time updates
    } else {
      console.error('❌ Chart initialization failed');
    }
  }, 500);
  
  // HTTP Polling functions (replaces MQTT)
  function startPolling() {
    console.log('🔄 Starting HTTP polling for real-time updates...');
    
    // Initial status update
    updateConnectionStatus();
    
    // Set up polling interval
    pollingInterval = setInterval(() => {
      updateConnectionStatus();
      // Only fetch new data if we're not already loading
      if (!isLoadingData) {
        checkForNewData();
      }
    }, pollingFrequency);
  }
  
  function updateConnectionStatus() {
    fetch('/api/health')
      .then(response => response.json())
      .then(status => {
        connectionStatus = { 
          connected: true, 
          lastPoll: new Date().toISOString(),
          service: status.service || 'HTTP API'
        };
        updateStatusDisplay();
      })
      .catch(error => {
        console.error('Connection check failed:', error);
        connectionStatus = { connected: false, lastPoll: new Date().toISOString() };
        updateStatusDisplay();
      });
  }
  
  function updateStatusDisplay() {
    const statusElement = document.getElementById('mqtt-status');
    if (statusElement) {
      const lastPollTime = connectionStatus.lastPoll ? 
        new Date(connectionStatus.lastPoll).toLocaleTimeString() : 'Never';
      
      statusElement.innerHTML = `
        <div class="mqtt-status ${connectionStatus.connected ? 'connected' : 'disconnected'}">
          <span class="status-indicator ${connectionStatus.connected ? 'online' : 'offline'}"></span>
          API: ${connectionStatus.connected ? 'Connected' : 'Disconnected'}
          <small style="display: block; font-size: 0.8em; opacity: 0.7;">
            Last update: ${lastPollTime}
          </small>
        </div>
      `;
    }
  }
  
  function checkForNewData() {
    fetch('/api/latest')
      .then(response => response.json())
      .then(result => {
        if (result.success && result.data) {
          const now = Date.now();
          // Throttle updates to prevent too frequent chart updates
          if (now - lastUpdateTime > 2000) { // 2 second throttle
            updateLatestReading(result.data);
            lastUpdateTime = now;
          }
        }
      })
      .catch(error => {
        console.error('Error checking for new data:', error);
      });
  }
  
  // Load dashboard data (combines latest + history + MQTT data)
  function loadDashboardData() {
    if (isLoadingData) {
      console.log('⏳ Data loading already in progress, skipping...');
      return;
    }
    
    isLoadingData = true;
    console.log('🔄 Loading dashboard data...');
    
    fetch('/api/dashboard')
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
      })
      .then(data => {
        console.log('📊 Dashboard data received:', data);
        
        // Update current sensor data
        if (data.current) {
          updateSensorDisplay(data.current.temperature, data.current.humidity);
          
          // Show data source indicator
          const sourceElement = document.getElementById('data-source');
          if (sourceElement) {
            const sourceText = data.current.source === 'retain_message' ? 'MQTT Retain' : 
                             data.current.source === 'database' ? 'Database' : 'Default';
            sourceElement.textContent = `Source: ${sourceText}`;
            sourceElement.className = `data-source ${data.current.source}`;
          }
        }
        
        // Update chart with history
        if (data.history && chart) {
          allHistoryData = data.history;
          updateChartWithOptimizedData(data.history);
        }
        
        // Update connection status (replaces MQTT status)
        connectionStatus = { 
          connected: true, 
          lastPoll: new Date().toISOString() 
        };
        updateStatusDisplay();
        
        // Update statistics
        if (data.stats) {
          updateStatistics(data.stats);
        }
        
        isLoadingData = false;
        console.log('✅ Dashboard data loaded successfully');
      })
      .catch(error => {
        console.error('❌ Error loading dashboard data:', error);
        isLoadingData = false;
        
        // Fallback: load data separately
        loadHistoryData();
        updateConnectionStatus();
      });
  }
  
  // Load MQTT retain messages
  function loadRetainMessages() {
    fetch('/api/mqtt/retain')
      .then(response => response.json())
      .then(messages => {
        retainMessages = messages;
        displayRetainMessages(messages);
        console.log('📨 Retain messages loaded:', messages.length);
      })
      .catch(error => {
        console.error('Error loading retain messages:', error);
      });
  }
  
  // Display retain messages in UI
  function displayRetainMessages(messages) {
    const container = document.getElementById('retain-messages-container');
    if (!container) return;
    
    if (messages.length === 0) {
      container.innerHTML = '<p class="no-data">No retain messages available</p>';
      return;
    }
    
    const html = messages.map(msg => {
      let parsedMessage = msg.message;
      try {
        const parsed = JSON.parse(msg.message);
        if (parsed.temp !== undefined && parsed.hum !== undefined) {
          parsedMessage = `Temp: ${parsed.temp}°C, Humidity: ${parsed.hum}%`;
        }
      } catch (e) {
        // Keep original message if not JSON
      }
      
      return `
        <div class="retain-message-item">
          <div class="message-header">
            <span class="topic">${msg.topic}</span>
            <span class="timestamp">${new Date(msg.timestamp).toLocaleString()}</span>
          </div>
          <div class="message-content">${parsedMessage}</div>
          ${msg.deviceId ? `<div class="device-id">Device: ${msg.deviceId}</div>` : ''}
        </div>
      `;
    }).join('');
    
    container.innerHTML = html;
  }
  
  // This function is now replaced by updateStatusDisplay() defined earlier
  // Keeping this for backwards compatibility, but it just calls the new function
  function updateMQTTStatusDisplay() {
    updateStatusDisplay();
  }
  
  // Recovery function for MQTT data
  function recoverMQTTData() {
    const recoverBtn = document.getElementById('recover-btn');
    if (recoverBtn) {
      recoverBtn.textContent = 'Recovering...';
      recoverBtn.disabled = true;
    }
    
    fetch('/api/mqtt/recover', { method: 'POST' })
      .then(response => response.json())
      .then(result => {
        if (result.success) {
          console.log('✅ MQTT data recovery completed');
          // Refresh dashboard data
          loadDashboardData();
          loadRetainMessages();
        } else {
          console.error('❌ MQTT recovery failed:', result.error);
        }
      })
      .catch(error => {
        console.error('❌ Error during MQTT recovery:', error);
      })
      .finally(() => {
        if (recoverBtn) {
          recoverBtn.textContent = 'Recover Data';
          recoverBtn.disabled = false;
        }
      });
  }
  
  // Expose functions to global scope for buttons
  window.recoverMQTTData = recoverMQTTData;
  window.loadRetainMessages = loadRetainMessages;
  
  // Update waktu
  function updateTime() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    document.getElementById('current-time').textContent = timeStr;
  }
  
  setInterval(updateTime, 1000);
  updateTime();
  
  // Chart initialization function
  function initializeChart() {
    const canvasElement = document.getElementById('sensorChart');
    if (!canvasElement) {
      console.error('Canvas element with id "sensorChart" not found!');
      return null;
    }
    
    const ctx = canvasElement.getContext('2d');
    
    try {
      const chart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: [],
          datasets: [
            {
              label: 'Suhu (°C)',
              data: [],
              borderColor: '#FF9500',
              backgroundColor: 'rgba(255, 149, 0, 0.12)',
              tension: 0.4,
              fill: true,
              yAxisID: 'y'
            },
            {
              label: 'Kelembaban (%)',
              data: [],
              borderColor: '#2E6DE0',
              backgroundColor: 'rgba(46, 109, 224, 0.12)',
              tension: 0.4,
              fill: true,
              yAxisID: 'y1'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            intersect: false,
            mode: 'index'
          },
          plugins: {
            title: {
              display: true,
              text: 'Trend Suhu & Kelembaban - 3 Jam Terakhir'
            },
            legend: {
              position: 'top'
            }
          },
          scales: {
            x: {
              grid: { display: false }
            },
            y: {
              type: 'linear',
              display: true,
              position: 'left',
              title: {
                display: true,
                text: 'Suhu (°C)',
                color: '#FF9500'
              }
            },
            y1: {
              type: 'linear',
              display: true,
              position: 'right',
              grid: { drawOnChartArea: false },
              title: {
                display: true,
                text: 'Kelembaban (%)',
                color: '#2E6DE0'
              }
            }
          }
        }
      });
      
      console.log('✅ Chart initialized successfully');
      
      // Check if there's pending chart data to load
      if (window.pendingChartData) {
        console.log('📊 Loading pending chart data...');
        updateChartWithOptimizedData(window.pendingChartData);
        window.pendingChartData = null;
      } else {
        // Load initial data after a short delay
        setTimeout(() => {
          console.log('📊 Loading initial data for chart...');
          loadHistoryData();
        }, 100);
      }
      
      return chart;
      
    } catch (error) {
      console.error('Error creating chart:', error);
      const parent = canvasElement.parentElement;
      parent.innerHTML = `
        <div style="text-align: center; padding: 50px; color: #666; border: 1px dashed #ccc;">
          <h3>Grafik Tidak Dapat Dimuat</h3>
          <p>Error: ${error.message}</p>
          <p>Silakan refresh halaman atau hubungi administrator.</p>
        </div>
      `;
      return null;
    }
  }
  
  // Setup chart - initialize via function call
  let chart = null;
  
  // Socket.io connection
  const socket = io();
  
  socket.on('update', function(data) {
    // Update nilai sensor
    document.getElementById('temperature-value').textContent = data.temperature.toFixed(1);
    document.getElementById('humidity-value').textContent = data.humidity.toFixed(1);
    
    // Update timestamp dengan informasi lengkap
    updateTimestamp(data.timestamp, data.receivedAt, data.deviceId);
    
    // Update status
    updateStatus('temperature', data.temperature);
    updateStatus('humidity', data.humidity);
    
    // Throttle real-time updates (max 1 update per 5 seconds)
    const now = Date.now();
    if (now - lastUpdateTime < 5000) {
      return;
    }
    lastUpdateTime = now;
    
    // Add new data to history if within current period
    if (data.timestamp) {
      const newData = {
        timestamp: data.timestamp,
        temperature: data.temperature,
        humidity: data.humidity,
        receivedAt: data.receivedAt,
        deviceId: data.deviceId
      };
      
      // Check if data is within current period
      if (isDataWithinPeriod(newData, currentPeriod)) {
        // Add to history and update displays
        addDataToHistory(newData);
        
        // Update chart secara smooth hanya untuk periode pendek
        if (currentPeriod <= 1) {
          updateChartSmoothly(newData);
        }
      }
    }
  });
  
  function updateStatus(type, value) {
    const element = document.getElementById(`${type}-status`);
    
    if (type === 'temperature') {
      if (value < 20) {
        element.textContent = 'Dingin';
        element.style.color = '#2E6DE0';
        element.style.backgroundColor = 'rgba(46, 109, 224, 0.12)';
      } else if (value > 28) {
        element.textContent = 'Panas';
        element.style.color = '#FF9500';
        element.style.backgroundColor = 'rgba(255, 149, 0, 0.12)';
      } else {
        element.textContent = 'Normal';
        element.style.color = '#2E6DE0';
        element.style.backgroundColor = 'rgba(46, 109, 224, 0.12)';
      }
    } else if (type === 'humidity') {
      if (value < 40) {
        element.textContent = 'Kering';
        element.style.color = '#DC8000';
        element.style.backgroundColor = 'rgba(220, 128, 0, 0.12)';
      } else if (value > 70) {
        element.textContent = 'Lembab';
        element.style.color = '#2E6DE0';
        element.style.backgroundColor = 'rgba(46, 109, 224, 0.12)';
      } else {
        element.textContent = 'Normal';
        element.style.color = '#2E6DE0';
        element.style.backgroundColor = 'rgba(46, 109, 224, 0.12)';
      }
    }
  }
  
  function updateChart(chartInstance, history) {
    try {
      if (!chartInstance) {
        console.warn('Chart instance not provided, skipping update');
        return;
      }
      
      if (!history || !Array.isArray(history) || history.length === 0) {
        console.log('No history data available for chart');
        chartInstance.data.labels = [];
        chartInstance.data.datasets[0].data = [];
        chartInstance.data.datasets[1].data = [];
        chartInstance.update('none');
        return;
      }
      
      const labels = history.map(item => item.time || '');
      const tempData = history.map(item => parseFloat(item.temperature) || 0);
      const humData = history.map(item => parseFloat(item.humidity) || 0);
      
      // Update dynamic scales dengan perubahan yang lebih halus
      if (tempData.length > 0 && tempData.some(val => !isNaN(val))) {
        const validTemps = tempData.filter(val => !isNaN(val));
        const minTemp = Math.min(...validTemps);
        const maxTemp = Math.max(...validTemps);
        
        // Berikan padding yang cukup untuk menghindari perubahan skala yang sering
        const tempPadding = Math.max(2, (maxTemp - minTemp) * 0.1);
        const newMinTemp = Math.floor(minTemp - tempPadding);
        const newMaxTemp = Math.ceil(maxTemp + tempPadding);
        
        // Hanya update skala jika perubahan signifikan
        if (chartInstance.options.scales.y.min === undefined || chartInstance.options.scales.y.max === undefined ||
            newMinTemp < chartInstance.options.scales.y.min || newMaxTemp > chartInstance.options.scales.y.max) {
          chartInstance.options.scales.y.min = newMinTemp;
          chartInstance.options.scales.y.max = newMaxTemp;
        }
      }
      
      if (humData.length > 0 && humData.some(val => !isNaN(val))) {
        const validHums = humData.filter(val => !isNaN(val));
        const minHum = Math.min(...validHums);
        const maxHum = Math.max(...validHums);
        
        // Berikan padding yang cukup untuk humidity
        const humPadding = Math.max(5, (maxHum - minHum) * 0.1);
        const newMinHum = Math.floor(minHum - humPadding);
        const newMaxHum = Math.ceil(maxHum + humPadding);
        
        // Hanya update skala jika perubahan signifikan
        if (chartInstance.options.scales.y1.min === undefined || chartInstance.options.scales.y1.max === undefined ||
            newMinHum < chartInstance.options.scales.y1.min || newMaxHum > chartInstance.options.scales.y1.max) {
          chartInstance.options.scales.y1.min = newMinHum;
          chartInstance.options.scales.y1.max = newMaxHum;
        }
      }
      
      chartInstance.data.labels = labels;
      chartInstance.data.datasets[0].data = tempData;
      chartInstance.data.datasets[1].data = humData;
      chartInstance.update('none');
    } catch (error) {
      console.error('Error in updateChart:', error);
    }
  }
  
  // Fungsi untuk load data history berdasarkan periode (IMPROVED & EFFICIENT)
  async function loadHistoryData() {
    if (isLoadingData) {
      console.log('Data loading already in progress, skipping...');
      return;
    }
    
    isLoadingData = true;
    
    try {
      console.log(`📊 Loading history data for period: ${currentPeriod} days`);
      
      // Determine optimal data limit based on period
      let dataLimit;
      if (currentPeriod === 0.125) dataLimit = 300;      // 3 hours - lebih banyak data mentah
      else if (currentPeriod === 1) dataLimit = 1000;    // 1 day - tingkatkan untuk lebih detail
      else if (currentPeriod === 3) dataLimit = 1500;    // 3 days 
      else if (currentPeriod <= 7) dataLimit = 2000;     // 1 week
      else if (currentPeriod <= 30) dataLimit = 3000;    // 1 month
      else dataLimit = 5000;                              // 3 months - lebih banyak data historis
      
      // Single API call for both table and chart data
      const response = await fetch(`/api/readings?days=${currentPeriod}&limit=${dataLimit}`);
      const rawData = await response.json();
      
      if (!Array.isArray(rawData)) {
        console.error('❌ Invalid data format received:', rawData);
        return;
      }
      
      console.log(`📦 Received ${rawData.length} raw data points from API`);
      
      // Filter data to exact period (server might return more)
      const cutoffDate = getPeriodCutoffDate(currentPeriod);
      const filteredData = rawData.filter(item => 
        new Date(item.timestamp) >= cutoffDate
      );
      
      console.log(`🔍 Filtered to ${filteredData.length} data points for period`);
      
      // Update global history
      allHistoryData = filteredData;
      
      // Update table and count with actual filtered data
      updateHistoryTable(allHistoryData);
      updateDataCount(allHistoryData.length);
      
      // Generate chart data efficiently
      const chartData = generateChartData(allHistoryData, currentPeriod);
      console.log(`📈 Generated ${chartData.length} chart data points`);
      
      // Update chart with processed data (only if chart is ready)
      if (chart) {
        console.log('📊 Updating chart with new data...');
        updateChartWithOptimizedData(chartData);
      } else {
        console.warn('⚠️  Chart not ready yet, storing data for later update');
        // Store data to be used when chart becomes available
        window.pendingChartData = chartData;
      }
      
      console.log(`✅ Loaded ${allHistoryData.length} readings for ${currentPeriod} days period`);
      
    } catch (error) {
      console.error('Error loading history:', error);
    } finally {
      isLoadingData = false;
    }
  }
  
  // Fungsi untuk generate chart data yang optimal
  function generateChartData(data, period) {
    if (!data || data.length === 0) return [];
    
    // Sort data by timestamp (oldest first for chart)
    const sortedData = [...data].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    // Group data based on period for optimal chart display
    let groupedData;
    
    if (period === 0.125) {
      // 3 hours: Group by 3-minute intervals untuk detail tinggi
      groupedData = groupDataByInterval(sortedData, 3, 'minutes');
    } else if (period === 1) {
      // 1 day: Group by 15-minute intervals untuk lebih banyak data points  
      groupedData = groupDataByInterval(sortedData, 15, 'minutes');
    } else if (period === 3) {
      // 3 days: Group by 1-hour intervals
      groupedData = groupDataByInterval(sortedData, 1, 'hours');
    } else if (period <= 7) {
      // 1 week: Group by 2-hour intervals
      groupedData = groupDataByInterval(sortedData, 2, 'hours');
    } else if (period <= 30) {
      // 1 month: Group by 6-hour intervals
      groupedData = groupDataByInterval(sortedData, 6, 'hours');
    } else {
      // 3 months: Group by 1-day intervals
      groupedData = groupDataByInterval(sortedData, 1, 'days');
    }
    
    return groupedData;
  }
  
  // Fungsi universal untuk grouping data berdasarkan interval
  function groupDataByInterval(data, intervalSize, intervalType) {
    const groups = {};
    
    data.forEach(item => {
      const date = new Date(item.timestamp);
      let key;
      
      switch (intervalType) {
        case 'minutes':
          const roundedMinutes = Math.floor(date.getMinutes() / intervalSize) * intervalSize;
          date.setMinutes(roundedMinutes, 0, 0);
          key = date.getTime();
          break;
        case 'hours':
          const roundedHours = Math.floor(date.getHours() / intervalSize) * intervalSize;
          date.setHours(roundedHours, 0, 0, 0);
          key = date.getTime();
          break;
        case 'days':
          date.setHours(0, 0, 0, 0);
          const dayKey = Math.floor(date.getTime() / (intervalSize * 24 * 60 * 60 * 1000));
          key = dayKey * intervalSize * 24 * 60 * 60 * 1000;
          break;
        default:
          key = date.getTime();
      }
      
      if (!groups[key]) {
        groups[key] = {
          timestamp: new Date(key),
          temperatures: [],
          humidities: [],
          count: 0
        };
      }
      
      groups[key].temperatures.push(item.temperature);
      groups[key].humidities.push(item.humidity);
      groups[key].count++;
    });
    
    // Convert to array and calculate averages
    return Object.values(groups).map(group => ({
      timestamp: group.timestamp,
      temperature: group.temperatures.reduce((a, b) => a + b) / group.temperatures.length,
      humidity: group.humidities.reduce((a, b) => a + b) / group.humidities.length,
      count: group.count
    })).sort((a, b) => a.timestamp - b.timestamp);
  }

  // Fungsi untuk update chart dengan data yang sudah dioptimasi
  function updateChartWithOptimizedData(optimizedData) {
    try {
      if (!chart) {
        console.warn('Chart not initialized yet, skipping update');
        return;
      }
      
      if (!optimizedData || optimizedData.length === 0) {
        console.log('No optimized data available for chart');
        chart.data.labels = [];
        chart.data.datasets[0].data = [];
        chart.data.datasets[1].data = [];
        chart.update('none');
        
        // Update fullscreen chart if active
        if (isFullscreenMode && fullscreenChart) {
          fullscreenChart.data.labels = [];
          fullscreenChart.data.datasets[0].data = [];
          fullscreenChart.data.datasets[1].data = [];
          fullscreenChart.update('none');
        }
        return;
      }
      
      // Generate labels based on period
      const labels = optimizedData.map(item => {
        const timestamp = new Date(item.timestamp);
        
        if (currentPeriod === 0.125) {
          // 3 jam: HH:MM (3-minute intervals)
          return timestamp.toLocaleTimeString('id-ID', { 
            hour: '2-digit', 
            minute: '2-digit' 
          });
        } else if (currentPeriod === 1) {
          // 1 hari: HH:MM (15-minute intervals untuk lebih detail)
          return timestamp.toLocaleTimeString('id-ID', { 
            hour: '2-digit',
            minute: '2-digit'
          });
        } else if (currentPeriod === 3) {
          // 3 hari: DD HH (day + hour)
          return timestamp.toLocaleDateString('id-ID', { 
            day: '2-digit',
            hour: '2-digit'
          }).replace(',', ' ');
        } else if (currentPeriod <= 7) {
          // 1 minggu: Day HH (2-hour intervals)
          return timestamp.toLocaleDateString('id-ID', { 
            weekday: 'short',
            hour: '2-digit'
          });
        } else if (currentPeriod <= 30) {
          // 1 bulan: DD/MM HH (6-hour intervals)
          return timestamp.toLocaleDateString('id-ID', { 
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit'
          });
        } else {
          // 3 bulan: DD MMM (daily intervals)
          return timestamp.toLocaleDateString('id-ID', { 
            day: '2-digit',
            month: 'short'
          });
        }
      });
      
      const temperatureData = optimizedData.map(item => parseFloat(item.temperature) || 0);
      const humidityData = optimizedData.map(item => parseFloat(item.humidity) || 0);
      
      // Calculate optimal scale ranges
      let tempStats, humStats;
      if (temperatureData.length > 0) {
        tempStats = calculateDataStats(temperatureData);
        chart.options.scales.y.min = tempStats.min - tempStats.padding;
        chart.options.scales.y.max = tempStats.max + tempStats.padding;
      }
      
      if (humidityData.length > 0) {
        humStats = calculateDataStats(humidityData);
        chart.options.scales.y1.min = Math.max(0, humStats.min - humStats.padding);
        chart.options.scales.y1.max = Math.min(100, humStats.max + humStats.padding);
      }
      
      // Update main chart data
      chart.data.labels = labels;
      chart.data.datasets[0].data = temperatureData;
      chart.data.datasets[1].data = humidityData;
      chart.update('none');
      
      // Update fullscreen chart if active
      if (isFullscreenMode && fullscreenChart) {
        // Apply same scale ranges
        if (tempStats) {
          fullscreenChart.options.scales.y.min = tempStats.min - tempStats.padding;
          fullscreenChart.options.scales.y.max = tempStats.max + tempStats.padding;
        }
        
        if (humStats) {
          fullscreenChart.options.scales.y1.min = Math.max(0, humStats.min - humStats.padding);
          fullscreenChart.options.scales.y1.max = Math.min(100, humStats.max + humStats.padding);
        }
        
        fullscreenChart.data.labels = labels;
        fullscreenChart.data.datasets[0].data = temperatureData;
        fullscreenChart.data.datasets[1].data = humidityData;
        fullscreenChart.update('none');
      }
      
      console.log(`Chart updated with ${labels.length} optimized data points`);
      
      // Update chart title
      updateChartTitle();
      if (isFullscreenMode) {
        updateFullscreenChartTitle();
      }
      
    } catch (error) {
      console.error('Error updating chart with optimized data:', error);
    }
  }
  
  // Fungsi untuk menghitung statistik data dan padding optimal
  function calculateDataStats(dataArray) {
    const validData = dataArray.filter(val => !isNaN(val) && val !== null);
    if (validData.length === 0) return { min: 0, max: 100, padding: 10 };
    
    const min = Math.min(...validData);
    const max = Math.max(...validData);
    const range = max - min;
    
    // Dynamic padding based on data range
    let padding;
    if (range < 5) padding = 2;
    else if (range < 10) padding = 3;
    else if (range < 20) padding = 5;
    else padding = Math.ceil(range * 0.1);
    
    return {
      min: Math.floor(min),
      max: Math.ceil(max),
      padding,
      range
    };
  }

  // ========== EFFICIENT HISTORY MANAGEMENT FUNCTIONS ==========
  
  // Fungsi untuk mengecek apakah data dalam periode tertentu
  function isDataWithinPeriod(data, period) {
    const now = new Date();
    const dataTime = new Date(data.timestamp);
    
    if (period === 0.125) {
      // For "terkini" (3 hours)
      const threeHoursAgo = new Date(now.getTime() - (3 * 60 * 60 * 1000));
      return dataTime >= threeHoursAgo;
    } else if (period === 1) {
      // For "hari ini" - from start of today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return dataTime >= today;
    } else {
      // For other periods - X days ago
      const daysDiff = (now - dataTime) / (1000 * 60 * 60 * 24);
      return daysDiff <= period;
    }
  }
  
  // Fungsi untuk menambah data ke history secara efisien
  function addDataToHistory(newData) {
    // Add to beginning (newest first)
    allHistoryData.unshift(newData);
    
    // Clean up old data efficiently
    const now = new Date();
    allHistoryData = allHistoryData.filter(item => {
      return isDataWithinPeriod(item, currentPeriod);
    }).slice(0, 1000); // Limit to 1000 items
    
    // Update displays
    updateHistoryTable(allHistoryData);
    updateDataCount(allHistoryData.length);
  }
  
  // Fungsi untuk mendapatkan periode cut-off date
  function getPeriodCutoffDate(period) {
    const now = new Date();
    
    if (period === 0.125) {
      // 3 hours ago
      return new Date(now.getTime() - (3 * 60 * 60 * 1000));
    } else if (period === 1) {
      // Start of today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return today;
    } else {
      // X days ago
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - Math.floor(period));
      return cutoff;
    }
  }
  
  // Fungsi untuk menghitung jumlah data aktual dalam periode
  function getActualDataCount(data, period) {
    const cutoffDate = getPeriodCutoffDate(period);
    return data.filter(item => new Date(item.timestamp) >= cutoffDate).length;
  }

  // Fungsi untuk update history table
  function updateHistoryTable(history) {
    const tableBody = document.getElementById('history-table');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    if (history.length === 0) {
      const row = document.createElement('tr');
      const periodText = {
        0.125: '3 jam terakhir',
        1: 'hari ini',
        3: '3 hari terakhir', 
        7: 'seminggu terakhir',
        30: 'sebulan terakhir',
        90: '3 bulan terakhir'
      };
      row.innerHTML = `<td colspan="3" style="text-align: center; color: var(--text-muted); padding: 20px;">Belum ada data untuk ${periodText[currentPeriod]}</td>`;
      tableBody.appendChild(row);
      return;
    }

    // Sort by timestamp descending (newest first) and limit display for performance
    const maxDisplayRows = currentPeriod <= 1 ? 100 : 150; // Lebih banyak rows untuk periode pendek
    const sortedHistory = [...history]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, maxDisplayRows);
    
    // Create document fragment for better performance
    const fragment = document.createDocumentFragment();
    
    sortedHistory.forEach(item => {
      const row = document.createElement('tr');
      
      const timeCell = document.createElement('td');
      const date = new Date(item.timestamp);
      
      // Format waktu yang lebih efisien
      const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const dayName = dayNames[date.getDay()];
      
      // Different time format based on period
      let timeFormat;
      if (currentPeriod <= 1) {
        // For short periods, show detailed time
        timeFormat = `
          <div style="font-weight: 600; color: var(--primary-color); margin-bottom: 2px;">
            ${dayName}, ${date.toLocaleDateString('id-ID')}
          </div>
          <div style="font-size: 12px; color: var(--text-muted);">
            ${date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
        `;
      } else {
        // For longer periods, show simplified time
        timeFormat = `
          <div style="font-weight: 600; color: var(--primary-color);">
            ${date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: '2-digit' })}
          </div>
          <div style="font-size: 12px; color: var(--text-muted);">
            ${date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
          </div>
        `;
      }
      
      timeCell.innerHTML = timeFormat;
      
      const tempCell = document.createElement('td');
      tempCell.innerHTML = `<span style="font-weight: 500; color: var(--warning-color);">${item.temperature.toFixed(1)}°C</span>`;
      tempCell.style.textAlign = 'center';
      
      const humCell = document.createElement('td');
      humCell.innerHTML = `<span style="font-weight: 500; color: var(--primary-color);">${item.humidity.toFixed(1)}%</span>`;
      humCell.style.textAlign = 'center';
      
      row.appendChild(timeCell);
      row.appendChild(tempCell);
      row.appendChild(humCell);
      
      fragment.appendChild(row);
    });
    
    // Add "show more" indicator if data was truncated
    if (history.length > maxDisplayRows) {
      const moreRow = document.createElement('tr');
      moreRow.innerHTML = `
        <td colspan="3" style="text-align: center; color: var(--text-muted); padding: 10px; font-style: italic;">
          Menampilkan ${maxDisplayRows} dari ${history.length} data (${((maxDisplayRows/history.length) * 100).toFixed(0)}%)
        </td>
      `;
      fragment.appendChild(moreRow);
    }
    
    tableBody.appendChild(fragment);
  }
  
  // Period filter event listener
  const periodFilter = document.getElementById('period-select');
  if (periodFilter) {
    periodFilter.addEventListener('change', function() {
      const selectedPeriod = this.value;
      console.log('Period filter changed to:', selectedPeriod);
      currentPeriod = parseFloat(selectedPeriod);
      
      // Update chart title immediately
      updateChartTitle();
      
      // Load data untuk periode yang dipilih
      loadHistoryData();
    });
  }

  // Function to update data count
  function updateDataCount(count) {
    const counterElement = document.getElementById('data-count');
    if (counterElement) {
      counterElement.textContent = `${count} data`;
    }
  }
  
  function updateTimestamp(timestamp, receivedAt, deviceId) {
    const timestampElement = document.getElementById('timestamp');
    if (!timestampElement) return;
    
    const deviceTime = new Date(timestamp);
    const serverTime = receivedAt ? new Date(receivedAt) : null;
    const timeDiff = serverTime ? Math.abs(serverTime - deviceTime) : 0;
    
    let timestampHTML = `<span class="timestamp-text">📅 ${deviceTime.toLocaleString('id-ID')}</span>`;
    
    if (serverTime && timeDiff > 1000) { // If difference > 1 second
        timestampHTML += `<span class="received-time">📡 Diterima: ${serverTime.toLocaleTimeString('id-ID')}</span>`;
        timestampHTML += `<span class="time-diff">⏱️ Delay: ${timeDiff}ms</span>`;
    }
    
    if (deviceId) {
        timestampHTML += `<span class="device-id">🔧 ${deviceId}</span>`;
    }
    
    timestampElement.innerHTML = timestampHTML;
  }
  
  // Function to update chart title based on current period
  function updateChartTitle() {
    if (!chart) {
      console.warn('Chart not initialized, cannot update title');
      return;
    }
    
    const periodTitles = {
      0.125: 'Trend Suhu & Kelembaban - 3 Jam Terakhir',
      1: 'Trend Suhu & Kelembaban - Hari Ini',
      3: 'Trend Suhu & Kelembaban - 3 Hari Terakhir',
      7: 'Trend Suhu & Kelembaban - Seminggu Terakhir',
      30: 'Trend Suhu & Kelembaban - Sebulan Terakhir',
      90: 'Trend Suhu & Kelembaban - 3 Bulan Terakhir'
    };
    
    if (chart && chart.options.plugins.title) {
      chart.options.plugins.title.text = periodTitles[currentPeriod] || 'Trend Suhu & Kelembaban';
      chart.update('none'); // Update without animation for better performance
    }
  }

  // Fungsi untuk update chart secara smooth tanpa mereset skala
  function updateChartSmoothly(newData) {
    try {
      if (!chart) {
        console.warn('Chart not initialized, cannot update smoothly');
        return;
      }
      
      if (!newData || typeof newData.temperature === 'undefined' || typeof newData.humidity === 'undefined') {
        return;
      }
      
      const currentTime = new Date(newData.timestamp);
      const timeLabel = currentTime.toLocaleTimeString('id-ID', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      
      // Tambah data baru ke akhir
      chart.data.labels.push(timeLabel);
      chart.data.datasets[0].data.push(parseFloat(newData.temperature));
      chart.data.datasets[1].data.push(parseFloat(newData.humidity));
      
      // Batasi jumlah data yang ditampilkan untuk performa (maksimal 50 data points)
      const maxDataPoints = 50;
      if (chart.data.labels.length > maxDataPoints) {
        chart.data.labels.shift(); // Hapus data terlama
        chart.data.datasets[0].data.shift();
        chart.data.datasets[1].data.shift();
      }
      
      // Hanya update skala jika data baru berada di luar range saat ini
      const currentTemp = parseFloat(newData.temperature);
      const currentHum = parseFloat(newData.humidity);
      
      // Untuk temperature
      if (currentTemp < chart.options.scales.y.min) {
        chart.options.scales.y.min = Math.floor(currentTemp - 1);
      } else if (currentTemp > chart.options.scales.y.max) {
        chart.options.scales.y.max = Math.ceil(currentTemp + 1);
      }
      
      // Untuk humidity
      if (currentHum < chart.options.scales.y1.min) {
        chart.options.scales.y1.min = Math.floor(currentHum - 5);
      } else if (currentHum > chart.options.scales.y1.max) {
        chart.options.scales.y1.max = Math.ceil(currentHum + 5);
      }
      
      // Update chart dengan animasi halus
      chart.update('active');
      
      // Update fullscreen chart jika sedang aktif
      if (isFullscreenMode && fullscreenChart) {
        updateFullscreenChartSmoothly(newData);
      }
      
    } catch (error) {
      console.error('Error in updateChartSmoothly:', error);
    }
  }

  // ========== FULLSCREEN CHART FUNCTIONALITY ==========
  
  function setupFullscreenFunctionality() {
    const fullscreenBtn = document.getElementById('chart-fullscreen-btn');
    const fullscreenModal = document.getElementById('chart-fullscreen-modal');
    const fullscreenCloseBtn = document.getElementById('fullscreen-close-btn');
    const fullscreenPeriodSelect = document.getElementById('fullscreen-period-select');
    
    if (!fullscreenBtn || !fullscreenModal || !fullscreenCloseBtn) {
      console.warn('Fullscreen elements not found');
      return;
    }
    
    // Open fullscreen
    fullscreenBtn.addEventListener('click', function() {
      openFullscreenChart();
    });
    
    // Close fullscreen
    fullscreenCloseBtn.addEventListener('click', function() {
      closeFullscreenChart();
    });
    
    // Close on background click
    fullscreenModal.addEventListener('click', function(e) {
      if (e.target === fullscreenModal) {
        closeFullscreenChart();
      }
    });
    
    // Escape key to close
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && isFullscreenMode) {
        closeFullscreenChart();
      }
    });
    
    // Fullscreen period filter
    if (fullscreenPeriodSelect) {
      // Sync with main period filter
      const mainPeriodSelect = document.getElementById('period-select');
      if (mainPeriodSelect) {
        fullscreenPeriodSelect.value = mainPeriodSelect.value;
      }
      
      fullscreenPeriodSelect.addEventListener('change', function() {
        currentPeriod = parseFloat(this.value);
        
        // Sync with main period filter
        if (mainPeriodSelect) {
          mainPeriodSelect.value = this.value;
        }
        
        // Update both charts
        loadHistoryData();
        updateFullscreenChartTitle();
      });
    }
  }
  
  function openFullscreenChart() {
    const fullscreenModal = document.getElementById('chart-fullscreen-modal');
    const fullscreenCanvas = document.getElementById('fullscreenChart');
    
    if (!fullscreenModal || !fullscreenCanvas) {
      console.error('Fullscreen elements not found');
      return;
    }
    
    isFullscreenMode = true;
    fullscreenModal.classList.add('active');
    document.body.style.overflow = 'hidden'; // Prevent background scroll
    
    // Initialize fullscreen chart
    setTimeout(() => {
      initializeFullscreenChart();
    }, 100);
  }
  
  function closeFullscreenChart() {
    const fullscreenModal = document.getElementById('chart-fullscreen-modal');
    
    if (!fullscreenModal) return;
    
    isFullscreenMode = false;
    fullscreenModal.classList.remove('active');
    document.body.style.overflow = ''; // Restore background scroll
    
    // Destroy fullscreen chart to free memory
    if (fullscreenChart) {
      fullscreenChart.destroy();
      fullscreenChart = null;
    }
  }
  
  function initializeFullscreenChart() {
    const fullscreenCanvas = document.getElementById('fullscreenChart');
    
    if (!fullscreenCanvas) {
      console.error('Fullscreen canvas not found');
      return;
    }
    
    // Destroy existing chart if any
    if (fullscreenChart) {
      fullscreenChart.destroy();
    }
    
    const ctx = fullscreenCanvas.getContext('2d');
    
    try {
      fullscreenChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: [],
          datasets: [
            {
              label: 'Suhu (°C)',
              data: [],
              borderColor: '#FF9500',
              backgroundColor: 'rgba(255, 149, 0, 0.12)',
              tension: 0.4,
              fill: true,
              yAxisID: 'y',
              pointRadius: 2,
              pointHoverRadius: 6
            },
            {
              label: 'Kelembaban (%)',
              data: [],
              borderColor: '#2E6DE0',
              backgroundColor: 'rgba(46, 109, 224, 0.12)',
              tension: 0.4,
              fill: true,
              yAxisID: 'y1',
              pointRadius: 2,
              pointHoverRadius: 6
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: getFullscreenChartTitle(),
              font: {
                size: 18,
                weight: 'bold'
              }
            },
            legend: {
              position: 'top',
              labels: {
                font: {
                  size: 14
                }
              }
            }
          },
          scales: {
            x: {
              grid: { 
                display: true,
                color: 'rgba(0, 0, 0, 0.1)'
              },
              ticks: {
                font: {
                  size: 12
                }
              }
            },
            y: {
              type: 'linear',
              display: true,
              position: 'left',
              title: {
                display: true,
                text: 'Suhu (°C)',
                color: '#FF9500',
                font: {
                  size: 14,
                  weight: 'bold'
                }
              },
              ticks: {
                font: {
                  size: 12
                }
              }
            },
            y1: {
              type: 'linear',
              display: true,
              position: 'right',
              grid: { drawOnChartArea: false },
              title: {
                display: true,
                text: 'Kelembaban (%)',
                color: '#2E6DE0',
                font: {
                  size: 14,
                  weight: 'bold'
                }
              },
              ticks: {
                font: {
                  size: 12
                }
              }
            }
          },
          interaction: {
            intersect: false,
            mode: 'index'
          }
        }
      });
      
      console.log('✅ Fullscreen chart initialized');
      
      // Copy data from main chart
      if (chart && chart.data) {
        copyChartData(chart, fullscreenChart);
      }
      
    } catch (error) {
      console.error('Error creating fullscreen chart:', error);
    }
  }
  
  function copyChartData(sourceChart, targetChart) {
    if (!sourceChart || !targetChart || !sourceChart.data || !targetChart.data) {
      return;
    }
    
    targetChart.data.labels = [...sourceChart.data.labels];
    targetChart.data.datasets[0].data = [...sourceChart.data.datasets[0].data];
    targetChart.data.datasets[1].data = [...sourceChart.data.datasets[1].data];
    
    // Copy scale options
    if (sourceChart.options.scales.y.min !== undefined) {
      targetChart.options.scales.y.min = sourceChart.options.scales.y.min;
      targetChart.options.scales.y.max = sourceChart.options.scales.y.max;
    }
    
    if (sourceChart.options.scales.y1.min !== undefined) {
      targetChart.options.scales.y1.min = sourceChart.options.scales.y1.min;
      targetChart.options.scales.y1.max = sourceChart.options.scales.y1.max;
    }
    
    targetChart.update('none');
  }
  
  function updateFullscreenChartSmoothly(newData) {
    if (!fullscreenChart || !newData) return;
    
    const currentTime = new Date(newData.timestamp);
    const timeLabel = currentTime.toLocaleTimeString('id-ID', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    
    // Add new data
    fullscreenChart.data.labels.push(timeLabel);
    fullscreenChart.data.datasets[0].data.push(parseFloat(newData.temperature));
    fullscreenChart.data.datasets[1].data.push(parseFloat(newData.humidity));
    
    // Limit data points for performance
    const maxDataPoints = 100; // More data points in fullscreen
    if (fullscreenChart.data.labels.length > maxDataPoints) {
      fullscreenChart.data.labels.shift();
      fullscreenChart.data.datasets[0].data.shift();
      fullscreenChart.data.datasets[1].data.shift();
    }
    
    fullscreenChart.update('active');
  }
  
  function getFullscreenChartTitle() {
    const periodTitles = {
      0.125: 'Trend Suhu & Kelembaban - 3 Jam Terakhir (Mode Fullscreen)',
      1: 'Trend Suhu & Kelembaban - Hari Ini (Mode Fullscreen)',
      3: 'Trend Suhu & Kelembaban - 3 Hari Terakhir (Mode Fullscreen)',
      7: 'Trend Suhu & Kelembaban - Seminggu Terakhir (Mode Fullscreen)',
      30: 'Trend Suhu & Kelembaban - Sebulan Terakhir (Mode Fullscreen)',
      90: 'Trend Suhu & Kelembaban - 3 Bulan Terakhir (Mode Fullscreen)'
    };
    
    return periodTitles[currentPeriod] || 'Trend Suhu & Kelembaban (Mode Fullscreen)';
  }
  
  function updateFullscreenChartTitle() {
    if (fullscreenChart && fullscreenChart.options.plugins.title) {
      fullscreenChart.options.plugins.title.text = getFullscreenChartTitle();
      fullscreenChart.update('none');
    }
  }
  
  // Update latest reading (for HTTP polling)
  function updateLatestReading(newReading) {
    if (!newReading) return;
    
    // Update the latest reading display
    const tempElement = document.querySelector('.temp-value');
    const humElement = document.querySelector('.humidity-value');
    const timestampElement = document.querySelector('.last-update');
    
    if (tempElement) tempElement.textContent = `${newReading.temperature}°C`;
    if (humElement) humElement.textContent = `${newReading.humidity}%`;
    if (timestampElement) {
      const updateTime = new Date(newReading.timestamp).toLocaleString();
      timestampElement.textContent = `Last update: ${updateTime}`;
    }
    
    // Add to chart if chart exists and we have valid data
    if (chart && chart.data && chart.data.datasets && chart.data.datasets.length > 0) {
      const timestamp = new Date(newReading.timestamp);
      
      // Only add if this is newer than the last data point
      const lastIndex = chart.data.labels.length - 1;
      if (lastIndex < 0 || new Date(chart.data.labels[lastIndex]) < timestamp) {
        // Add new data point
        chart.data.labels.push(timestamp);
        chart.data.datasets[0].data.push(newReading.temperature);
        chart.data.datasets[1].data.push(newReading.humidity);
        
        // Keep only last 100 points for performance
        if (chart.data.labels.length > 100) {
          chart.data.labels.shift();
          chart.data.datasets[0].data.shift();
          chart.data.datasets[1].data.shift();
        }
        
        chart.update('none'); // Update without animation for better performance
      }
    }
    
    console.log('📊 Updated latest reading:', newReading);
  }
  
  // Cleanup function for when page unloads
  window.addEventListener('beforeunload', () => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      console.log('🧹 Cleaned up polling interval');
    }
  });

  // Pause/resume polling when page visibility changes
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      // Page is now hidden, reduce polling frequency
      if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = setInterval(() => {
          updateConnectionStatus();
        }, 30000); // 30 seconds when hidden
      }
    } else {
      // Page is now visible, restore normal polling
      if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = setInterval(() => {
          updateConnectionStatus();
          if (!isLoadingData) {
            checkForNewData();
          }
        }, pollingFrequency);
      }
    }
  });
});
