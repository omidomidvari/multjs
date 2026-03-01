// multjs.js - Zero-dependency automation workflow library
// Version: 1.0.0

class Step {
    constructor(config) {
        this.name = config.name || 'Unnamed step';
        this.run = config.run;
        this.env = config.env || {};
        this.if = config.if || (() => true);
        this.timeout = config.timeout || 30000; // 30 seconds default
        this.retries = config.retries || 0;
    }

    async execute(context) {
        console.log(`▶️  ${this.name}`);
        
        // Check condition
        if (typeof this.if === 'function' && !this.if(context)) {
            console.log(`   ⏭️  Skipped (condition not met)`);
            return { skipped: true, name: this.name };
        }

        let lastError;
        
        for (let attempt = 0; attempt <= this.retries; attempt++) {
            try {
                if (attempt > 0) {
                    console.log(`   🔄 Retry ${attempt}/${this.retries}`);
                }

                const result = await this._executeWithTimeout(context);
                console.log(`   ✅ Success`);
                return { success: true, name: this.name, result };
                
            } catch (error) {
                lastError = error;
                console.log(`   ❌ Attempt ${attempt + 1} failed: ${error.message}`);
                
                if (attempt < this.retries) {
                    await this._delay(1000 * Math.pow(2, attempt)); // Exponential backoff
                }
            }
        }
        
        throw new Error(`Step "${this.name}" failed after ${this.retries + 1} attempts: ${lastError.message}`);
    }

    async _executeWithTimeout(context) {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error(`Timeout after ${this.timeout}ms`));
            }, this.timeout);

            Promise.resolve()
                .then(() => {
                    if (typeof this.run === 'function') {
                        return this.run({ ...context, ...this.env });
                    } else if (typeof this.run === 'string') {
                        return this._executeShellCommand(this.run, context);
                    } else {
                        throw new Error('Step must have a "run" function or command string');
                    }
                })
                .then(resolve)
                .catch(reject)
                .finally(() => clearTimeout(timeoutId));
        });
    }

    async _executeShellCommand(command, context) {
        // Simple shell command execution (for Node.js environments)
        if (typeof process === 'undefined' || !process.versions.node) {
            throw new Error('Shell commands require Node.js environment');
        }

        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execAsync = promisify(exec);

        // Replace variables in command: ${{ inputs.name }} or ${context.key}
        const processedCommand = command.replace(/\$\{\{\s*([^}]+)\s*\}\}/g, (match, key) => {
            const trimmed = key.trim();
            return context[trimmed] || '';
        });

        const { stdout, stderr } = await execAsync(processedCommand, { env: { ...process.env, ...this.env } });
        
        return {
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            command: processedCommand
        };
    }

    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

class Job {
    constructor(name, config) {
        this.name = name;
        this.steps = config.steps.map(step => new Step(step));
        this.needs = config.needs || [];
        this.if = config.if || (() => true);
        this.timeout = config.timeout || 300000; // 5 minutes default
    }

    async canRun(completedJobs) {
        return this.needs.every(job => completedJobs.has(job));
    }

    async execute(context) {
        console.log(`\n📦 Job: ${this.name}`);
        
        // Check job condition
        if (typeof this.if === 'function' && !this.if(context)) {
            console.log(`⏭️  Job skipped (condition not met)`);
            return { skipped: true, name: this.name };
        }

        const results = [];
        
        for (const step of this.steps) {
            try {
                const result = await step.execute({ ...context, job: this.name });
                results.push(result);
                
                // Stop if step failed (unless it was skipped)
                if (!result.success && !result.skipped) {
                    throw new Error(`Step "${step.name}" failed`);
                }
                
            } catch (error) {
                throw new Error(`Job "${this.name}" failed: ${error.message}`);
            }
        }
        
        return { success: true, name: this.name, results };
    }
}

class Workflow {
    constructor(name, config) {
        this.name = name;
        this.on = config.on || ['manual'];
        this.jobs = {};
        this.variables = config.variables || {};
        
        // Create job instances
        for (const [jobName, jobConfig] of Object.entries(config.jobs || {})) {
            this.jobs[jobName] = new Job(jobName, jobConfig);
        }
    }

    _resolveJobOrder() {
        const jobs = Object.values(this.jobs);
        const order = [];
        const visited = new Set();
        const temp = new Set();
        
        const visit = (job) => {
            if (temp.has(job)) throw new Error(`Circular dependency detected involving job "${job.name}"`);
            if (visited.has(job)) return;
            
            temp.add(job);
            
            for (const depName of job.needs) {
                const depJob = this.jobs[depName];
                if (!depJob) throw new Error(`Job "${depName}" not found (needed by "${job.name}")`);
                visit(depJob);
            }
            
            temp.delete(job);
            visited.add(job);
            order.push(job);
        };
        
        for (const job of jobs) {
            if (!visited.has(job)) {
                visit(job);
            }
        }
        
        return order;
    }

    async execute(inputs = {}) {
        console.log(`\n🚀 Starting workflow: ${this.name}`);
        console.log(`📅 Trigger: ${Array.isArray(this.on) ? this.on.join(', ') : this.on}`);
        
        const context = {
            ...this.variables,
            ...inputs,
            workflow: this.name,
            timestamp: new Date().toISOString()
        };
        
        const jobOrder = this._resolveJobOrder();
        const completedJobs = new Set();
        const results = {};
        
        for (const job of jobOrder) {
            if (await job.canRun(completedJobs)) {
                try {
                    const jobResult = await job.execute(context);
                    results[job.name] = jobResult;
                    
                    if (!jobResult.skipped) {
                        completedJobs.add(job.name);
                    }
                    
                    // Pass job outputs to context for dependent jobs
                    if (jobResult.success && jobResult.results) {
                        context[job.name] = jobResult.results;
                    }
                    
                } catch (error) {
                    console.error(`\n💥 Workflow failed at job "${job.name}": ${error.message}`);
                    throw error;
                }
            } else {
                console.log(`\n⏸️  Job "${job.name}" waiting for dependencies: ${job.needs.filter(n => !completedJobs.has(n)).join(', ')}`);
            }
        }
        
        console.log(`\n🎉 Workflow "${this.name}"
